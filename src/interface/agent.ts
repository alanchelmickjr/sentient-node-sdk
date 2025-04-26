import { Query } from './request'; // To be ported
import { ResponseHandler } from './response_handler'; // To be ported
import { Session } from './session'; // To be ported

/**
 * An agent that has an identity and an assist method.
 */
export abstract class AbstractAgent {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Process the request and generate a response.
   */
  abstract assist(
    session: Session,
    query: Query,
    responseHandler: ResponseHandler
  ): Promise<void>;
}