import { SessionObject } from '../interface/request'; // TODO: Ensure TS port exists
import { Interaction } from '../interface/session'; // TODO: Ensure TS port exists

/**
 * Default implementation of the Session interface.
 * Simply returns values from the session object.
 */
export class DefaultSession {
  private _sessionObject: SessionObject;

  constructor(sessionObject: SessionObject) {
    this._sessionObject = sessionObject;
    // LOG: Construction
    console.info('[DefaultSession][LOG] Created with sessionObject:', sessionObject);
  }

  get processorId(): string {
    // LOG: Access processorId
    console.info('[DefaultSession][LOG] Accessing processorId');
    return this._sessionObject.processorId;
  }

  get activityId(): string {
    // LOG: Access activityId
    console.info('[DefaultSession][LOG] Accessing activityId');
    return this._sessionObject.activityId;
  }

  get requestId(): string {
    // LOG: Access requestId
    console.info('[DefaultSession][LOG] Accessing requestId');
    return this._sessionObject.requestId;
  }

  getInteractions(): AsyncIterable<Interaction> {
    // LOG: Access getInteractions
    console.info('[DefaultSession][LOG] Accessing getInteractions');
    return this._sessionObject.interactions;
  }
}