import {isType} from '@toreda/strong-types';
import {LogActionConsole} from './log/action/console';
import {LogGroup} from './log/group';
import {LogGroupData} from './log/group/data';
import {LogLevels} from './log/levels';
import {
	LogLevelDisable,
	LogLevelDisableMultiple,
	LogLevelEnable,
	LogLevelEnableMultiple
} from './log/levels/helpers';
import {LogMessage} from './log/message';
import {LogOptions} from './log/options';
import {LogState} from './log/state';
import {LogTransport} from './log/transport';

/**
 * Main log class holding attached transports and internal state
 * data, and logging configuration.
 */
export class Log {
	/** Serializable internal state data */
	public readonly state: LogState;

	public constructor(options?: LogOptions) {
		this.state = new LogState(options);

		// Activate console logging if allowed by start options.
		if (this.state.consoleEnabled()) {
			this.activateDefaultConsole();
		}
	}

	/**
	 * Enable global console logging for development and debugging.
	 */
	public activateDefaultConsole(level?: number): void {
		level = level ?? this.state.globalLogLevel();
		const transport = new LogTransport('console', level, LogActionConsole);
		this.addTransport(transport);
	}

	/**
	 * Attempt to make new log group with target id. Does not
	 * overwrite existing groups.
	 * @param group 		target log group to create.
	 * @returns 			Whether make group operation was successful. `false` when
	 * 						group already exists or failed. `true` when group with target
	 * 						id is created successfully.
	 */
	public makeGroup(group: LogGroupData): boolean {
		if (typeof group.id !== 'string' || !group.id) {
			return false;
		}

		if (this.state.groups[group.id]) {
			return false;
		}

		const enabled = group.enabled ?? this.state.groupsEnabledOnStart();
		const level = group.level ?? this.state.globalLogLevel();

		this.state.groupKeys.push(group.id);
		this.state.groups[group.id] = new LogGroup(group.id, level, enabled);
		return true;
	}

	/**
	 * Searches for a group with matching id. Return null unless
	 * useDefault is true, which return default group instead. Also
	 * return the default group if no args are passed.
	 * @param id The id of the group
	 */
	public getGroup(): LogGroup;
	public getGroup(id: string): LogGroup | null;
	public getGroup(id: string | null | undefined, useDefault: false): LogGroup | null;
	public getGroup(id: string | null | undefined, useDefault: true): LogGroup;
	public getGroup(id?: string | undefined, useDefault?: boolean): LogGroup | null {
		if (typeof id === 'string' && this.state.groups[id]) {
			return this.state.groups[id];
		}

		if (useDefault || (id == null && useDefault === undefined)) {
			return this.state.groups.default;
		}

		return null;
	}

	public initGroups(groups?: LogGroupData[]): void {
		if (!groups) {
			return;
		}

		if (!Array.isArray(groups)) {
			return;
		}

		for (const group of groups) {
			if (typeof group.id === 'string' && typeof group.level === 'number') {
				this.setGroupLevel(group.level, group.id);
			}
		}
	}

	/**
	 * Add transport to target group.
	 * @param transport 		Transport to add to target group.
	 *
	 * @param id			Target group to add transport to. When null the `default`
	 * 							group is used. When target is non-null and target group does
	 * 							not exist, it will be created.
	 */
	public addTransport(transport: LogTransport, id?: string): boolean {
		if (!transport || !(transport instanceof LogTransport)) {
			console.error(Error('transport is not a LogTransport.'));
			return false;
		}

		let group: LogGroup | null;

		if (id == null) {
			group = this.getGroup();
		} else {
			this.makeGroup({id, level: LogLevels.ALL, enabled: true});
			group = this.getGroup(id, true);
		}

		return group.addTransport(transport);
	}

	/**
	 * Remove transport from target group, or from the 'all' group if
	 * id is null.
	 * @param transport
	 * @param id
	 */
	public removeTransport(transport: LogTransport, id?: string): boolean {
		const group = this.getGroup(id, true);
		return group.removeTransport(transport);
	}

	/**
	 * Remove transport matching target id from target group if
	 * both the group exists and the transport is in the group.
	 * @param transportId
	 * @param id
	 */
	public removeTransportById(transportId: string, id?: string): boolean {
		const group = this.getGroup(id, true);

		for (let i = group.transports.length - 1; i >= 0; i--) {
			const transport = group.transports[i];

			// Remove matching transport and exit. Only one
			// of each transport can be added to a group.
			if (transport.id === transportId) {
				group.transports.splice(i, 1);
				return true;
			}
		}

		return false;
	}

	/**
	 * Remove matching transports from all groups. Expensive call not suitable to
	 * use generally, but available for specific cases where transports must be removed
	 * and may exist in multiple unknown groups. Prefer to use use `removeTransport` or
	 * `removeGroupTransport` when possible.
	 * @param transport
	 */
	public removeTransportEverywhere(transport: LogTransport): boolean {
		if (!transport || !isType(transport, LogTransport)) {
			return false;
		}

		let removeCount = 0;
		for (const groupName of this.state.groupKeys) {
			const group = this.getGroup(groupName, true);
			const result = group.removeTransport(transport);
			if (result) {
				removeCount++;
			}
		}

		return removeCount > 0;
	}

	/**
	 * Change global log level. Individual group levels
	 * are used instead of global level when they are set.
	 * @param logLevel
	 */
	public setGlobalLevel(level: number): void {
		this.state.globalLogLevel(level);
	}

	/**
	 * Add a level flag to the global log level without
	 * affecting other global level flags. Has no effect
	 * if target level flag is already enabled.
	 * @param level
	 */
	public enableGlobalLevel(logLevel: number): void {
		LogLevelEnable(this.state.globalLogLevel, logLevel);
	}

	/**
	 * Add multiple flags to global log level. Performs
	 * sanity checks on each provided level and discards
	 * invalid values.
	 * @param levels
	 */
	public enableGlobalLevels(logLevels: number[]): void {
		LogLevelEnableMultiple(this.state.globalLogLevel, logLevels);
	}

	public disableGlobalLevel(logLevel: number): void {
		LogLevelDisable(this.state.globalLogLevel, logLevel);
	}

	public disableGlobalLevels(logLevels: number[]): void {
		LogLevelDisableMultiple(this.state.globalLogLevel, logLevels);
	}

	/**
	 * Set log level for target group.
	 * @param logLevel
	 * @param id
	 */
	public setGroupLevel(logLevel: number, id?: string): void {
		const group = this.getGroup(id, true);
		group.setLogLevel(logLevel);
	}

	public enableGroupLevel(logLevel: number, id?: string): void {
		const group = this.getGroup(id, true);
		group.enableLogLevel(logLevel);
	}

	public enableGroupLevels(logLevels: number[], id?: string): void {
		const group = this.getGroup(id, true);
		group.enableLogLevels(logLevels);
	}

	public disableGroupLevel(logLevel: number, id?: string): void {
		const group = this.getGroup(id, true);
		group.disableLogLevel(logLevel);
	}

	public disableGroupLevels(logLevels: number[], id?: string): void {
		const group = this.getGroup(id, true);
		group.disableLogLevels(logLevels);
	}

	/**
	 * Create structured log message. Provided as a call argument
	 * during transport execution.
	 * @param ts			UTC timestamp when msg was created.
	 * @param level			Level bitmask msg was logged with.
	 * @param msg			Msg that was logged.
	 */
	private createMessage(date: string, level: number, ...msg: unknown[]): LogMessage {
		let message: string;

		if (msg.length > 1) {
			message = JSON.stringify(msg);
		} else if (msg.length === 0) {
			message = '';
		} else if (typeof msg[0] === 'string') {
			message = msg[0];
		} else {
			message = JSON.stringify(msg[0]);
		}

		return {date, level, message};
	}

	/**
	 * Log message to default group.
	 * @param level
	 * @param msg
	 */
	public log(level: number, ...msg: unknown[]): Log {
		const logMsg: LogMessage = this.createMessage('', level, ...msg);

		this.state.groups.all.log(this.state.globalLogLevel(), logMsg);
		this.getGroup().log(this.state.globalLogLevel(), logMsg);

		return this;
	}

	/**
	 * Log message to target group. If id is null send to global.
	 * @param id 		Target group to send log message to.
	 * @param level
	 * @param msg
	 */
	public logTo(id: string, level: number, ...msg: unknown[]): Log {
		const logMsg: LogMessage = this.createMessage('', level, ...msg);

		this.state.groups.all.log(this.state.globalLogLevel(), logMsg);
		this.getGroup(id)?.log(this.state.globalLogLevel(), logMsg);

		return this;
	}

	/**
	 * Trigger an error-level log message for no specific group (global).
	 * @param msg
	 */
	public error(...msg: unknown[]): Log {
		return this.logTo('default', LogLevels.ERROR, ...msg);
	}

	/**
	 * Trigger an error-level log message for target group.
	 * @param id
	 * @param msg
	 */
	public errorTo(id: string, ...msg: unknown[]): Log {
		return this.logTo(id, LogLevels.ERROR, ...msg);
	}

	/**
	 * Trigger a warn-level log message for no specific group (global).
	 * @param msg
	 */
	public warn(...msg: unknown[]): Log {
		return this.logTo('default', LogLevels.WARN, ...msg);
	}

	/**
	 * Trigger a warn-level log message for target group.
	 * @param id
	 * @param msg
	 */
	public warnTo(id: string, ...msg: unknown[]): Log {
		return this.logTo(id, LogLevels.WARN, ...msg);
	}

	/**
	 * Trigger an info-level log message for no specific group (global).
	 * @param args
	 */
	public info(...msg: unknown[]): Log {
		return this.logTo('default', LogLevels.INFO, ...msg);
	}

	/**
	 * Triggers an info-level log message for target group.
	 * @param id
	 * @param msg
	 */
	public infoTo(id: string, ...msg: unknown[]): Log {
		return this.logTo(id, LogLevels.INFO, ...msg);
	}

	/**
	 * Trigger a -level log message for no specific group (global).
	 * @param msg
	 */
	public debug(...msg: unknown[]): Log {
		return this.logTo('default', LogLevels.DEBUG, ...msg);
	}

	/**
	 * Trigger a debug-level log message for target group.
	 * @param id
	 * @param msg
	 */
	public debugTo(id: string, ...msg: unknown[]): Log {
		return this.logTo(id, LogLevels.DEBUG, ...msg);
	}

	/**
	 * Trigger a trace-level log message for no specific group (global).
	 * @param args
	 */
	public trace(...msg: unknown[]): Log {
		return this.logTo('default', LogLevels.TRACE, ...msg);
	}

	/**
	 * Trigger a trace-level log message for target group.
	 * @param id
	 * @param msg
	 */
	public traceTo(id: string, ...msg: unknown[]): Log {
		return this.logTo(id, LogLevels.TRACE, ...msg);
	}

	/**
	 * Clear all transports from all groups.
	 */
	public clearAll(): void {
		for (const id of this.state.groupKeys) {
			this.getGroup(id, true).clear();
			delete this.state.groups[id];
		}

		this.state.groupKeys.length = 0;

		this.makeGroup({enabled: true, level: LogLevels.ALL, id: 'all'});
		this.makeGroup({enabled: true, level: LogLevels.ALL, id: 'default'});
	}
}
