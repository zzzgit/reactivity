import { isNumericKey, isObject } from './utils.js'

// For internal use only, never expose this function directly
const reactive = (obj)=> {
	if (!isObject(obj)){
		return obj
	}

	for (const key in obj){
		if (isObject(obj[key])){
			obj[key] = reactive(obj[key])
		}
	}

	const isArray = Array.isArray(obj)
	const reactiveArrayMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'reverse', 'sort']

	return new Proxy(obj, {
		get(target, key){
			// Intercept array methods
			if (isArray && typeof target[key] === 'function' && reactiveArrayMethods.includes(key)){
				return function(...args){
					const result = Array.prototype[key].apply(target, args)

					// Keep track of triggered effects to avoid duplicates
					const triggeredEffects = new Set()

					// Notify length change
					if (target.__subscribers?.has('length')){
						const lengthEffects = target.__subscribers.get('length')
						lengthEffects.forEach((effect)=> {
							triggeredEffects.add(effect)
							effect()
						})
					}

					// Only notify index-based subscribers when necessary
					// This is more selective than re-running all effects
					if (target.__subscribers){
						// For numeric indices only
						target.__subscribers.forEach((effects, propKey)=> {
							// Already handled length subscribers
							if (propKey === 'length'){
								return
							}

							// Only trigger effects for numeric indices or specific properties
							if (isNumericKey(propKey)){
								effects.forEach((effect)=> {
									if (!triggeredEffects.has(effect)){
										triggeredEffects.add(effect)
										effect()
									}
								})
							}
						})
					}

					return result
				}
			}

			const value = target[key]
			// Track access
			if (currentEffect){
				// Create property-specific subscribers if they don't exist
				if (!target.__subscribers){
					target.__subscribers = new Map()
				}
				if (!target.__subscribers.has(key)){
					target.__subscribers.set(key, new Set())
				}
				target.__subscribers.get(key).add(currentEffect)
			}
			return value
		},
		set(target, key, value){
			const oldValue = target[key]
			if (oldValue === value){ return true }

			if (isObject(value)){
				target[key] = reactive(value)
			} else {
				target[key] = value
			}

			if (target.__subscribers?.has(key)){
				[...target.__subscribers.get(key)].forEach(effect=> effect())
			}

			// For arrays, also notify when an index changes
			if (isArray && isNumericKey(key)){
				// Length may have changed
				if (target.__subscribers?.has('length')){
					[...target.__subscribers.get('length')].forEach(effect=> effect())
				}
			}

			return true
		},
	})
}

const ref = (initialValue)=> {
	const subscribers = new Set()
	const wrappedValue = isObject(initialValue) ? reactive(initialValue) : initialValue

	const refObject = {
		_value: wrappedValue,
		get value(){
			if (currentEffect){
				subscribers.add(currentEffect)
			}
			return this._value
		},
		set value(newValue){
			if (this._value === newValue){ return }
			this._value = isObject(newValue) ? reactive(newValue) : newValue;
			[...subscribers].forEach(effect=> effect())
		},
	}

	return refObject
}

let currentEffect = null

const _effect = (effectFn)=> {
	const runEffect = ()=> {
		currentEffect = runEffect
		try {
			effectFn()
		} finally {
			currentEffect = null
		}
	}
	runEffect()
	return runEffect
}

const computed = (getter)=> {
	const result = ref(null)

	_effect(()=> {
		result.value = getter()
	})

	return {
		get value(){
			return result.value
		},
	}
}

const watch = (source, callback, options = {})=> {
	const getter = typeof source === 'function' ? source : ()=> source.value
	const { immediate = false } = options

	let oldValue
	let isFirstRun = true

	_effect(()=> {
		const newValue = getter()

		if (!isFirstRun || immediate){
			callback(newValue, oldValue)
		}

		oldValue = newValue
		isFirstRun = false
	})
}

export {
	// don't expose reactive directly
	ref, computed, watch,
}
