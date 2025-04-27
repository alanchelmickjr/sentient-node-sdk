import { Query } from './request';
import { ResponseHandler } from './response_handler';
import { Session } from './session';
/**
 * An agent that has an identity and an assist method.
 */
export declare abstract class AbstractAgent {
    name: string;
    constructor(name: string);
    /**
     * Process the request and generate a response.
     */
    abstract assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void>;
}
