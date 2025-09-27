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
	if (!currentEffect){
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
	const indexAndLengthMethods = ['push', 'pop', 'shift', 'unshift', 'splice']
	const indexOnlyMethods = ['reverse', 'sort']
	const handler = {
		get(target, key){
			if (key === IS_REACTIVE){
				return true
			}
			const reactiveArrayMethods = [...indexAndLengthMethods, ...indexOnlyMethods]
			const isIndexAndLength = indexAndLengthMethods.includes(key)
			// For array, this part can be moved to another place
			if (isArray && typeof target[key] === 'function' && reactiveArrayMethods.includes(key)){
				return function(...args){
					const result = Reflect.apply(Reflect.get(target, key), target, args)
					const depsMap = targetMap.get(target)
					if(!depsMap){
						return result
					}

					const triggeredEffects = new Set()

					// For methods that can change length, notify length subscribers
					if (isIndexAndLength){
						const lengthEffects = depsMap.get('length')
						lengthEffects?.forEach((effect)=> {
							triggeredEffects.add(effect)
							effect()
						})
					}

					// For numeric indices only
					depsMap.forEach((effects, propKey)=> {
						if (isNumericKey(propKey)){
							effects.forEach((effect)=> {
								if (!triggeredEffects.has(effect)){
									triggeredEffects.add(effect)
									effect()
								}
							})
						}
					})
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
	ref, computed, watch, isRef,
}
