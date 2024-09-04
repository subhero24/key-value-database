export default class JSONStorage {
	/**
	 * @param {Storage} value
	 */
	constructor(value) {
		this.value = value;
	}

	/**
	 * @param {number} index
	 * @returns {string|null}
	 */
	key(index) {
		return this.value.key(index);
	}

	/**
	 * @param {string} key
	 * @param {(this: any, key: string, value: any) => any} [func]
	 * @returns {any}
	 */
	getItem(key, func) {
		let value = this.value.getItem(key);
		if (value) {
			return JSON.parse(value, func);
		}
	}

	/**
	 * @param {string} key
	 * @param {any} value
	 * @param {(this: any, key: string, value: any) => any} [func]
	 */
	setItem(key, value, func) {
		this.value.setItem(key, JSON.stringify(value, func));
	}

	/**
	 * @param {string} key
	 */
	removeItem(key) {
		this.value.removeItem(key);
	}

	clear() {
		this.value.clear();
	}

	/**
	 * @returns {number}
	 */
	get length() {
		return this.value.length;
	}
}
