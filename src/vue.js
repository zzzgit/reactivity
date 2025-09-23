const reactive = (obj)=> {
	if (typeof obj !== 'object' || obj === null){
		return obj
	}

	// First, make nested objects reactive
	for (const key in obj){
		if (typeof obj[key] === 'object' && obj[key] !== null){
			obj[key] = reactive(obj[key])
		}
	}

	return new Proxy(obj, {
		get(target, key){
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

			// Make new nested objects reactive
			if (typeof value === 'object' && value !== null){
				target[key] = reactive(value)
			} else {
				target[key] = value
			}

			// Trigger updates
			if (target.__subscribers && target.__subscribers.has(key)){
				[...target.__subscribers.get(key)].forEach(effect=> effect())
			}
			return true
		},
	})
}

const ref = (initialValue)=> {
	const subscribers = new Set()
	const wrappedValue = typeof initialValue === 'object' && initialValue !== null ? reactive(initialValue) : initialValue

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
			this._value = typeof newValue === 'object' && newValue !== null ? reactive(newValue) : newValue;
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
	ref, computed, watch,
}
