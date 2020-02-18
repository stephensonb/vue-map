
//
// Defines the shape of the callback handler called when data is changed and is being sent
// to the subscribers.  Subscribers must implement a callback function with this shape.
//

export type DataChangedHandler<T> = (
  payload: DataItem<T>[],
  channel?: string,
  provider?: IDataProvider<T>
) => void;

//
// Data cache (key value store).  Basically a dictionary.
//

export type DataCache<T> = {
  [key: string]: T;
};

//
// Handle returned by registerPublisher.  Call unpublish on the handle when finished publishing data.
//

export interface IDataPublisherHandle<T> {
  publish(data: T | T[]): void;
  ready: () => boolean;
  unpublish: () => void;
}

//
// Handle returned by registerSubscriber.  Call unsubscribe on the handle when finished with
// the subscription.
//

export interface IDataSubscriberHandle<T> {
  unsubscribe: () => void;
}

//
// Data subscriber interface.  Data publishers must implement this interface
//

export interface IDataSubscriber<T> {
  id: string;
  channel?: string;
  updateType?: 'stream' | 'digest';
  onDataChanged: DataChangedHandler<T>;
}

//
// Data publisher interface.  Data publishers must implement this interface
//

export interface IDataPublisher<T> {
  id: string;
  channel?: string;
  lastPublishedTime: number;
}

//
// Define the generic DataProvider interface
//

export interface IDataProvider<T> {
  registerSubscriber(
    id: string,
    onDataChanged: DataChangedHandler<T>,
    channel?: string,
    updateType?: 'stream' | 'digest'
  ): IDataSubscriberHandle<T>;
  registerPublisher(id: string, channel?: string): IDataPublisherHandle<T>;
}

//
// Data channel - communications channel for related data items
//

export class DataChannel<T> {
  private _data: DataItem<T>[] = [];
  constructor(public name: string) {}

  public get data() {
    return this._data;
  }

  //
  // returns a set of data items added to channel from start time to end time.
  // if start time is omitted, will start from beginning of time according to Unix (1/1/1970)
  // if end time is omitted, will return data to the end of the channel.
  // Consumption of this data means that it will be removed from the channel once it is returned.
  //

  public consumeTimeChunk(startTime?: number, endTime?: number) {
    let startIndex: number = -1;
    let endIndex: number = -1;
    startTime = startTime || 0;
    endTime = endTime || Date.now();

    if (startTime > endTime) {
      let time = startTime;
      startTime = endTime;
      endTime = time;
    }

    // handle case with no start or end time = return all data in the channel
    if (startTime === 0 && endTime === 0) {
      startIndex = 0;
      endIndex = this._data.length;
    } else
      for (let i = 0; i < this._data.length; i++) {
        // find the chunk to return (all data between start and end time)
        if (startIndex < 0 && this._data[i].timestamp >= startTime) {
          startIndex = i;
        } else if (endIndex < 0 && this._data[i].timestamp > endTime) {
          endIndex = i + 1;
          break;
        }
      }

    // no data past end time found, so just return to end of data array
    if (endIndex < 0) {
      endIndex = this._data.length;
    }

    // return the data chunk and remove from the channel
    const chunk = this._data.splice(startIndex, endIndex - startIndex);
    return chunk;
  }

  //
  // Add a single data item to the channel
  //

  public add(data: T) {
    this._data.push({ data: { ...data }, timestamp: Date.now() });
  }

  //
  // Add an array of data items to the channel
  //

  public addMany(data: T[]) {
    const timestamp = Date.now();
    // add timestamps to all new data items
    const dataItems = data.map(item => ({ data: { ...item }, timestamp }));
    this._data = this._data.concat(dataItems);
  }

  //
  // clear all data from a channel
  //

  public clear() {
    this._data.splice(0, this._data.length);
  }
}

//
// Interface for a timestamped data item broadcast from a channel.  The timestamp is the time the
// original data was received from the publisher.  All data items received during a publish call have the
// same timestamp
//

export interface DataItem<T> {
  data: T;
  timestamp: number;
}

//
// A simple data provider class that can register data publishers and data subscribers to
// data "channels".  Data published to a channel is broadcast to all subscribers to that
// channel
//

export class DataProvider<T> implements IDataProvider<T> {
  private _cache: DataCache<DataChannel<T>> = {};
  private _channelDataAvailableQueue: string[] = [];
  private _subscribers: IDataSubscriber<T>[] = [];
  private _publishers: IDataPublisher<T>[] = [];
  private _isReady: boolean = false;

  public constructor() {
    this._isReady = true;
  }

  //
  // register a subscriber for a channel.  If channel does not exist, request is ignored.
  //

  public registerSubscriber(
    id: string,
    onDataChanged: DataChangedHandler<T>,
    channel?: string,
    updateType?: 'stream' | 'digest'
  ): IDataSubscriberHandle<T> {
    channel = channel || '__default__';
    if (
      this._subscribers.find(subscriber => subscriber.id === id && subscriber.channel === channel)
    ) {
      throw new Error(`registerSubscriber: duplicate registration for ${id} on channel ${channel}`);
    }
    this._subscribers.push({
      id,
      channel,
      onDataChanged,
      updateType,
    });
    return {
      unsubscribe: this.unsubscribe(this, id, channel),
    };
  }

  //
  // unsubscribe from a channel
  //

  private unsubscribe(provider: DataProvider<T>, id: string, channel?: string) {
    return (): void => {
      channel = channel || '__default__';
      if (provider._cache[channel]) {
        const index = provider._subscribers.findIndex(
          subscriber => subscriber.id === id && subscriber.channel === channel
        );
        if (index >= 0) {
          provider._subscribers.splice(index, 1);
        }
      }
    };
  }

  //
  // flag indicating if a channel has data to send
  //

  private isDataAvailable(channel?: string) {
    channel = channel || '__default__';
    if (this._cache[channel]) {
      return this._cache[channel].data.length > 0;
    }
    return false;
  }

  //
  // called when a publisher has published data to a channel
  //

  private onPublish(channel?: string) {
    channel = channel || '__default__';
    const dataChannel = this._cache[channel];
    if (this.isDataAvailable(channel)) {
      const chunk = dataChannel.consumeTimeChunk(0, Date.now());
      for (let subscriber of this._subscribers) {
        if (subscriber.updateType && subscriber.updateType === 'stream') {
          subscriber.onDataChanged(chunk, channel, this);
        } else {
          subscriber.onDataChanged(chunk, channel, this);
        }
      }
    }
  }

  //
  // method provided to a publisher to use for publishing data to a channel
  //

  private publish(provider: DataProvider<T>, id: string, channel: string) {
    return (data: T | T[]) => {
      provider._isReady = false;
      if (provider._publishers.find(publisher => publisher.id && publisher.channel)) {
        if (Array.isArray(data)) {
          provider._cache[channel].addMany(data);
          provider.onPublish(channel);
          provider._isReady = true;
        } else {
          provider._cache[channel].add(data);
          provider.onPublish(channel);
          provider._isReady = true;
        }
      }
    };
  }

  //
  // flag to indicate we can accept data from a publisher right now.
  //

  private ready(provider: DataProvider<T>) {
    return (): boolean => {
      return provider._isReady;
    };
  }

  //
  // register a publisher for a channel.  If the channel does not exist, a new one will be created.
  //

  public registerPublisher(id: string, channel?: string): IDataPublisherHandle<T> {
    channel = channel || '__default__';
    if (this._publishers.find(publisher => publisher.id === id && publisher.channel == channel)) {
      throw new Error(
        `registerPublisher error.  Publisher with id ${id} for channel ${channel} is already registered.`
      );
    }
    if (!this._cache[channel]) {
      this.createChannel(channel);
    }
    this._publishers.push({
      id,
      channel,
      lastPublishedTime: 0,
    });
    return {
      publish: this.publish(this, id, channel),
      ready: this.ready(this),
      unpublish: this.unpublish(this, id, channel),
    };
  }

  //
  // remove a publisher from publishing to a channel
  //

  private unpublish(provider: DataProvider<T>, id: string, channel: string) {
    return () => {
      const index = provider._publishers.findIndex(
        publisher => publisher.id === id && publisher.channel === channel
      );
      if (index >= 0) {
        provider._publishers.splice(index, 1);
      }
    };
  }

  //
  // create a new channel to publish/subscribe to
  //

  private createChannel(name: string) {
    if (this._cache[name]) {
      return;
    }
    this._cache[name] = new DataChannel<T>(name);
  }
}
