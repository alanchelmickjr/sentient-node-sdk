import { Event } from './events';

/**
 * A hook is used to emit agent events to the outside world.
 */
export interface Hook {
  /**
   * Emit an agent event.
   * @param event - The event to emit.
   */
  emit(event: Event): Promise<void>;
}