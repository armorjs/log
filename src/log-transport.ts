import {LogMessage} from './log-message';
import {LogTransportAction} from './log-transport-action';
import {LogTransportOptions} from './log-transport-options';
import {LogTransportState} from './log-transport-state';

export class LogTransport {
	public readonly execute: LogTransportAction;
	public readonly state: LogTransportState;

	constructor(action?: LogTransportAction, options?: LogTransportOptions) {
		this.execute = this.parseExecute(action);
		this.state = new LogTransportState(options);
	}

	public parseExecute(action?: LogTransportAction): LogTransportAction {
		if (!action) {
			return this.storeLog;
		}

		if (typeof action !== 'function') {
			throw new Error('LogTransport init failed - execute should be a function');
		}

		return (logMessage) => {
			this.storeLog(logMessage);
			return action(logMessage);
		};
	}

	public storeLog(logMessage: LogMessage): any {
		this.state.logs().push(logMessage);
	}

	public static logToConsole: LogTransportAction = (logMessage) => {
		return new Promise((resolve) => {
			let logString = '';
			logString += `[${logMessage.date}]`;
			logString += ` ${logMessage.level.toUpperCase()}:`;
			logString += ` ${logMessage.message}`;
			console.log(logString);
			resolve();
		});
	};
}
