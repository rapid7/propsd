import { EventEmitter } from 'events';

class EventBusWrapper extends EventEmitter { }

const EventBus = new EventBusWrapper();

export default EventBus;
