import { isNumericKey, isObject } from './utils.js'

const targetMap = new WeakMap()

const IS_REACTIVE = '__v_isReactive'
const IS_REF = '__v_isRef'

const isRef = (value)=> {
	return value && value[IS_REF] === true
}

const isReactive = (value)=> {
	return value && value[IS_REACTIVE] === true
}

const track = (target, key)=> {
	// Don't track if there's no current effect or if the effect is inactive
	if (!currentEffect || currentEffect.__active === false){
		return false
	}
	let depsMap = targetMap.get(target)
	if (!depsMap){
		depsMap = new Map()
		targetMap.set(target, depsMap)
	}

	let dep = depsMap.get(key)
	if (!dep){
		dep = new Set()
		depsMap.set(key, dep)
	}
	dep.add(currentEffect)
}

const trigger = (target, key)=> {
	const depsMap = targetMap.get(target)
	if (!depsMap){
		return false
	}
	const dep = depsMap.get(key)
	if (dep){
		[...dep].forEach((effect)=> {
			// Skip triggering the current effect to prevent infinite loops
			// 這種情況到底應該throw error還是直接忽略掉？
			// 目前的做法是忽略掉
			if (effect !== currentEffect){
				effect()
			}
		})
	}
}

const cleanupEffect = (effect)=> {
	for (const [target, depsMap] of targetMap.entries()){
		for (const [key, dep] of depsMap.entries()){
			if (dep.has(effect)){
				dep.delete(effect)
				if (dep.size === 0){
					depsMap.delete(key)
				}
				if (depsMap.size === 0){
					targetMap.delete(target)
				}
			}
		}
	}
}

// For internal use only, never expose this function directly
const reactive = (obj)=> {
	if (!isObject(obj)){
		return obj
	}
	if (isReactive(obj)){
		return obj
	}
	// here's two ways to make nested objects reactive. One is to do it lazily in the get() trap below,
	// the other is to do it eagerly here. This implementation does it eagerly.
	// This means that nested objects are made reactive immediately, rather than when they are accessed.
	// This can be more efficient if you know you'll be accessing those nested objects anyway.
	// However, it also means that we create more Proxy objects upfront.
	for (const key of Object.keys(obj)){
		if (isObject(obj[key])){
			obj[key] = reactive(obj[key])
		}
	}

	const isArray = Array.isArray(obj)
	const handler = {
		get(target, key){
			if (key === IS_REACTIVE){
				return true
			}
			const lengthMethods = ['shift', 'unshift', 'push', 'pop', 'splice']
			const indexMethods = ['reverse', 'sort', 'shift', 'unshift']
			const partialIndexMethods = ['fill', 'push', 'pop', 'splice', 'copyWithin']
			const isLengthMethods = lengthMethods.includes(key)
			const isFullIndexMethods = indexMethods.includes(key)
			const isPartialIndexMethods = partialIndexMethods.includes(key)
			const allArrayMethods = new Set([...lengthMethods, ...indexMethods, ...partialIndexMethods])
			// For array, this part can be moved to another place
			if (isArray && typeof target[key] === 'function' && allArrayMethods.has(key)){
				return function(...args){
					const result = Reflect.apply(Reflect.get(target, key), target, args)
					const depsMap = targetMap.get(target)
					if(!depsMap){
						return result
					}

					const triggeredEffects = new Set()

					// For methods that can change length, notify length subscribers
					if (isLengthMethods){
						const lengthEffects = depsMap.get('length')
						lengthEffects?.forEach((effect)=> {
							triggeredEffects.add(effect)
							effect()
						})
					}

					// For numeric indices only
					const numericDeps = depsMap.filter((_effect, propKey)=> isNumericKey(propKey))
					if(isFullIndexMethods){
						numericDeps.forEach((effect)=> {
							if (!triggeredEffects.has(effect)){
								triggeredEffects.add(effect)
								effect()
							}
						})
					}
					if(isPartialIndexMethods){
						let startIndex = 0
						if (key === 'push'){
							startIndex = target.length - 1
						} else if (key === 'pop'){
							// never trigger anything, since pop only removes the last item
							startIndex = target.length
						} else if (key === 'splice'){
							startIndex = args[0]
						} else if (key === 'fill'){
							startIndex = args[1] || 0
						}else if (key === 'copyWithin'){
							startIndex = args[0]
						}
						numericDeps.forEach((effect, propKey)=> {
							if (Number(propKey) >= startIndex){
								if (!triggeredEffects.has(effect)){
									triggeredEffects.add(effect)
									effect()
								}
							}
						})
					}
					triggeredEffects.clear()
					return result
				}
			}

			const value = Reflect.get(target, key)
			track(target, key)
			return value
		},
		set(target, key, value){
			const oldValue = target[key]
			if (oldValue === value){ return true }

			target[key] = isObject(value) ? reactive(value) : value

			trigger(target, key)

			// For arrays, there are some special cases to consider. 
			// If we add an item at an index >= length, we need to notify length subscribers.
			if (isArray && isNumericKey(key)){
				if (Number(key) >= target.length){
					trigger(target, 'length')
				}
			}

			return true
		},
	}
	return new Proxy(obj, handler)
}

const ref = (initialValue)=> {
	if (isRef(initialValue)){
		return initialValue
	}

	const raw = {
		value: isObject(initialValue) ? reactive(initialValue) : initialValue,
	}

	const refObject = {
		get value(){
			track(raw, 'value')
			return raw.value
		},
		set value(newValue){
			if (raw.value === newValue){ return }
			raw.value = isObject(newValue) ? reactive(newValue) : newValue
			trigger(raw, 'value')
		},
		[IS_REF]: true,
	}

	return refObject
}

let currentEffect = null

const _effect = (effectFn)=> {
	const runEffect = ()=> {
		if (runEffect.__active === false){
			return
		}
		currentEffect = runEffect
		try {
			effectFn()
		} finally {
			currentEffect = null
		}
	}
	runEffect.__active = true
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

	const effectRunner = _effect(()=> {
		const newValue = getter()

		if (!isFirstRun || immediate){
			callback(newValue, oldValue)
		}

		oldValue = newValue
		isFirstRun = false
	})

	return ()=> {
		// Since we can't iterate through a WeakMap directly,
		// we'll simply set the currentEffect to null when executing
		// the effectRunner, which will prevent it from re-registering
		// in dependency collections
		if (effectRunner){
			// We're using a null effect to prevent it from being tracked
			const originalEffect = currentEffect
			currentEffect = null
			try {
				effectRunner.__active = false
				cleanupEffect(effectRunner)
			} finally {
				currentEffect = originalEffect
			}
		}
	}
}

export {
	// don't expose reactive directly
	ref, computed, watch, isRef,
}
