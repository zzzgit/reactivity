const ref = (initialValue)=> {
	const subscribers = new Set()

	const refObject = {
		_value: initialValue,
		get value(){
			if (currentEffect){
				subscribers.add(currentEffect)
			}
			return this._value
		},
		set value(newValue){
			if (this._value === newValue){ return }
			this._value = newValue;
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
