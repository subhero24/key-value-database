import Table from './database-table.js';
import Index from './database-index.js';
import JSONStorage from './json-storage.js';

import enumerate from './utilities/string/enumerate.js';
import Listeners from './database-listeners.js';

/** @typedef {string|number} Id */

export default class Database {
	/**
	 * @param {Storage} storage
	 * @param {{ prefix?: string, migrations?: Array<function>, autoindex?: boolean, entropy?: number }} [options]
	 */
	constructor(storage, options) {
		let { prefix = '', migrations = [], autoindex = false, entropy = 1000000 } = options ?? {};

		this.prefix = prefix;
		this.entropy = entropy;
		this.autoindex = autoindex;

		/** @type {Object<string,Table>} */
		this.tables = {};
		this.execute = false;
		this.storage = new JSONStorage(storage);
		this.rowListeners = new Listeners();
		this.indexListeners = new Listeners();

		this.storageEventHandler = event => {
			let { key, oldValue, newValue, storageArea } = event;

			let isSameStorage = this.storage.value === storageArea;
			if (isSameStorage) {
				let isSameValue = oldValue === newValue;
				if (isSameValue === false) {
					this.rowListeners.notify(key);
				}
			}
		};

		let version = this.version ?? 0;
		for (let index = 0; index < migrations.length; index++) {
			if (index === version) this.execute = true;

			let backup = Object.entries(storage);
			let migration = migrations[index];
			try {
				migration.call(this, this);
				if (this.execute) {
					this.version = version + index + 1;
				}
			} catch (error) {
				storage.clear();
				for (let [key, value] of backup) {
					storage.setItem(key, value);
				}
				throw error;
			}
		}

		window.addEventListener('storage', this.storageEventHandler);
	}

	/**
	 * @param {string} tableName
	 * @param {string} [entryName]
	 * @returns {Table}
	 */
	addTable(tableName, entryName) {
		return new Table(this, tableName, entryName);
	}

	/**
	 * @param {string} tableName
	 * @returns {Table|undefined}
	 */
	findTable(tableName) {
		return this.tables[tableName];
	}

	/**
	 * @param {string} tableName
	 * @returns {Table}
	 */
	assertTable(tableName) {
		let table = this.findTable(tableName);
		if (table == undefined) throw new Error(`Table "${tableName}" does not exist`);
		return table;
	}

	/**
	 * @param {string} tableName
	 */
	removeTable(tableName) {
		let table = this.findTable(tableName);
		if (table == undefined) {
			if (process.env.NODE_ENV === 'development') {
				console.warn(`Table "${tableName}" does not exist`);
			}
		} else {
			table.destroy();
		}
	}

	/**
	 * @param {string} tableName
	 * @param  {Array<string|[string,function]>} attributes
	 * @returns {Index}
	 */
	addIndex(tableName, ...attributes) {
		let table = this.assertTable(tableName);
		let index = new Index(this, table, ...attributes);
		return index;
	}

	/**
	 * @param {string} tableName
	 * @param  {Array<string>} indexKeys
	 * @returns
	 */
	findIndex(tableName, ...indexKeys) {
		let indexes = this.findTable(tableName)?.indexes;
		if (indexes) {
			return indexes.find(
				index => index.keys.length === indexKeys.length && index.keys.every(key => indexKeys.includes(key)),
			);
		}
	}

	/**
	 * @param {string} tableName
	 * @param  {Array<string>} indexKeys
	 * @returns
	 */
	assertIndex(tableName, ...indexKeys) {
		let index = this.findIndex(tableName, ...indexKeys);
		if (index == undefined)
			throw new Error(`Table "${tableName}" does not have an index for ${enumerate(...indexKeys)}`);
		return index;
	}

	/**
	 * @param {string} tableName
	 * @param  {Array<string>} attributes
	 */
	removeIndex(tableName, ...attributes) {
		let index = this.findIndex(tableName, ...attributes);
		if (index == undefined) {
			if (process.env.NODE_ENV === 'development') {
				console.warn(`Index on ${enumerate(...attributes)} does not exist for table "${tableName}"`);
			}
		} else {
			index.destroy();
		}
	}

	get version() {
		return this.storage.getItem(`${this.prefix}#version`);
	}

	set version(version) {
		this.storage.setItem(`${this.prefix}#version`, version);
	}

	close() {
		window.removeEventListener('storage', this.storageEventHandler);
	}

	// Table functions

	/**
	 * @param {string} tableName
	 * @param {Id} id
	 * @returns {Object|undefined}
	 */
	find(tableName, id) {
		return this.assertTable(tableName).find(id);
	}

	/**
	 * @param {string} tableName
	 * @param {Object} [props]
	 * @param {boolean} [autoindex]
	 * @returns {Array<Id>}
	 */
	index(tableName, props, autoindex = this.autoindex) {
		return this.assertTable(tableName).index(props, autoindex);
	}

	/**
	 * @param {string} tableName
	 * @param {Object} [props]
	 * @param {boolean} [autoindex]
	 * @returns {number}
	 */
	count(tableName, props, autoindex = this.autoindex) {
		return this.assertTable(tableName).count(props, autoindex);
	}

	/**
	 * @param {string} tableName
	 * @param {Object|Id} [props]
	 * @param {boolean} [autoindex]
	 * @returns {Array<Object>|Object}
	 */
	select(tableName, props, autoindex = this.autoindex) {
		return this.assertTable(tableName).select(props, autoindex);
	}

	/**
	 * @param {string} tableName
	 * @param {Object} props
	 * @returns {Object}
	 */
	create(tableName, props) {
		return this.assertTable(tableName).create(props);
	}

	/**
	 * @param {string} tableName
	 * @param {Object} row
	 * @param {Object} [props]
	 * @returns {Object}
	 */
	update(tableName, row, props = {}) {
		return this.assertTable(tableName).update(row, props);
	}

	/**
	 * @param {string} tableName
	 * @param {Object|Id} row
	 * @returns {Object}
	 */
	delete(tableName, row) {
		return this.assertTable(tableName).delete(row);
	}

	// Storage functions

	/**
	 * @param {string} key
	 * @returns {Object|undefined}
	 */
	getItem(key) {
		return this.storage.getItem(key);
	}

	/**
	 * @param {string} key
	 * @param {Object} value
	 */
	setItem(key, value) {
		this.storage.setItem(key, value);
		this.rowListeners.notify(key);
	}

	/**
	 * @param {string} key
	 */
	removeItem(key) {
		this.storage.removeItem(key);
		this.rowListeners.notify(key);
	}

	// Subscription functions

	/**
	 * @param {string} tableName
	 * @param {Id} id
	 * @param {() => void} callback
	 * @returns {() => void}
	 */
	subscribeToRow(tableName, id, callback) {
		let table = this.assertTable(tableName);
		let rowKey = table.rowKey(id);
		let unsubscribe = this.rowListeners.add(rowKey, callback);
		return unsubscribe;
	}

	/**
	 * @param {string} tableName
	 * @param {() => void|Object} arg1
	 * @param {() => void} [arg2]
	 * @returns {() => void}
	 */
	subscribeToIndex(tableName, arg1, arg2) {
		let [props, callback] = arg2 == undefined ? [undefined, arg1] : [arg1, arg2];

		let table = this.assertTable(tableName);
		let indexKey = table.indexKey(props);
		let unsubscribe = this.rowListeners.add(indexKey, callback);
		return unsubscribe;
	}

	/**
	 * @param {string} tableName
	 * @param {() => void|Object} arg1
	 * @param {() => void} [arg2]
	 * @returns {() => void}
	 */
	subscribeToRows(tableName, arg1, arg2) {
		let [props, callback] = arg2 == undefined ? [undefined, arg1] : [arg1, arg2];

		let table = this.assertTable(tableName);
		let indexKey = table.indexKey(props);

		let indexIds = this.storage.getItem(indexKey);
		for (let id of indexIds) {
			this.rowListeners.add(table.rowKey(id), callback);
		}

		this.rowListeners.add(indexKey, callback);
		this.indexListeners.add(indexKey, callback);

		return () => {
			let indexIds = this.storage.getItem(indexKey);
			for (let id of indexIds) {
				this.rowListeners.remove(table.rowKey(id), callback);
			}

			this.rowListeners.remove(indexKey, callback);
			this.indexListeners.remove(indexKey, callback);
		};
	}
}
