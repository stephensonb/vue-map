import MapView from 'esri/views/MapView';
import View from 'esri/views/View';
import { IMapViewEventSubscriber } from './IMapViewEventSubscriber';

//
// MapViewEventDispatcher watches a set of maps belonging to a mapviewgroup and responds
// to events on the maps within the group to coordinate synchronization of the maps within the view.
//

export class MapViewEventDispatcher {
  private activeListener: IMapViewEventSubscriber | undefined = undefined;
  private subscribers: IMapViewEventSubscriber[] = [];

  public constructor() {}

  public isSubscribed(target: View): boolean {
    return this.subscribers.find(subscriber => Object.is(subscriber.target, target)) ? true : false;
  }

  public async subscribe(target: View): Promise<void> {
    // add if listener not already subscribed
    let subscriber = this.subscribers.find(subscriber => Object.is(subscriber.target, target));

    if (!subscriber) {
      subscriber = { target };
      subscriber.interactWatchHandle = target.watch(
        'interacting,animation',
        this.interactHandler(this, subscriber)
      );
      this.subscribers.push(subscriber);
    }
  }

  public async unsubscribe(target: View): Promise<void> {
    // remove the interact and animation watch events.
    const index = this.subscribers.findIndex(subscriber => Object.is(subscriber.target, target));
    if (index < 0) {
      return;
    }
    const subscriber = this.subscribers[index];
    if (subscriber) {
      // remove propertyWatch events
      this.removePropertyWatchers(subscriber);
      // remove interaction events
      subscriber.interactWatchHandle && subscriber.interactWatchHandle.remove();
      // remove from list of listeners
      this.subscribers.splice(index, 1);
    }
  }

  private addPropertyWatchers(subscriber: IMapViewEventSubscriber): void {
    if (subscriber) {
      subscriber.propertyWatchHandle = subscriber.target.watch(
        'viewpoint',
        this.updateHandler(this, subscriber)
      );
    }
  }

  private removePropertyWatchers(subscriber: IMapViewEventSubscriber | undefined): void {
    if (subscriber) {
      subscriber.propertyWatchHandle && subscriber.propertyWatchHandle.remove();
      subscriber.stationaryWatchHandle && subscriber.stationaryWatchHandle.remove();
      subscriber.propertyWatchHandle = undefined;
      subscriber.stationaryWatchHandle = undefined;
    }
  }

  private setListener(subscriber: IMapViewEventSubscriber): void {
    // start updating at the next frame
    subscriber.scheduleId = setTimeout(() => {
      this.addPropertyWatchers(subscriber);
      this.activeListener = subscriber;
    }, 0);
    subscriber.scheduleId = undefined;
    subscriber.stationaryWatchHandle = subscriber.target.watch(
      'stationary',
      this.stationaryHandler(this, subscriber)
    );
  }

  private switchListener(subscriber: IMapViewEventSubscriber): void {
    if (this.activeListener) {
      this.removePropertyWatchers(this.activeListener);
      if ((this.activeListener.target as View).animation) {
        (this.activeListener.target as View).animation.finish();
      }
    }
    this.setListener(subscriber);
  }

  //
  // Updates all views except active listener with new property value(s)
  private async updateViews(propertyName: string, newValue: any, source: View) {
    for (let otherSubscriber of this.subscribers) {
      // Skip this subscriber on the update
      if (!Object.is(otherSubscriber.target, source)) {
        if ((otherSubscriber.target as MapView)[propertyName]) {
          (otherSubscriber.target as MapView)[propertyName] = newValue;
        }
      }
    }
  }

  //
  // create and return an interaction handler for a subscriber
  //

  private interactHandler = (
    dispatcher: MapViewEventDispatcher,
    subscriber: IMapViewEventSubscriber
  ) => {
    return (newValue: any): void => {
      // ignore if new state is not interacting or animating (newValue === false)
      if (!newValue) {
        return;
      }
      if (subscriber.propertyWatchHandle || subscriber.scheduleId) {
        return;
      } else if (!dispatcher.activeListener) {
        // if no current listener, set new listener from idle state
        dispatcher.setListener(subscriber);
        return;
      } else if (!Object.is(dispatcher.activeListener.target, subscriber.target)) {
        // Switch listeners if another subscriber was the active listener
        dispatcher.switchListener(subscriber);
      }
    };
  };

  //
  // Create the handler to update the other subscribers when a property changes on the subscriber listener
  //

  private updateHandler = (
    dispatcher: MapViewEventDispatcher,
    subscriber: IMapViewEventSubscriber
  ) => {
    return async (newValue: any, oldValue: any, propertyName: string): Promise<void> => {
      // make sure we are only handling update events for the current listener
      if (Object.is(subscriber.target, dispatcher.activeListener?.target)) {
        await dispatcher.updateViews(propertyName, newValue, subscriber.target);
      }
    };
  };

  //
  // reset listener when current interaction/animation finishes
  //

  private stationaryHandler = (
    dispatcher: MapViewEventDispatcher,
    subscriber: IMapViewEventSubscriber
  ) => {
    return async (
      newValue: any,
      oldValue: any,
      propertyName: string,
      target: __esri.Accessor
    ): Promise<void> => {
      // only reset if we have a listener AND we are not still interacting with the listener
      // (even though animation may have finished)
      await dispatcher.updateViews(
        'viewpoint',
        (subscriber.target as MapView).viewpoint,
        subscriber.target
      );
      dispatcher.removePropertyWatchers(subscriber);
      dispatcher.activeListener = undefined;
    };
  };
}
