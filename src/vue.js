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
	triggerDeps(dep)
}

const triggerDeps = (dep)=> {
	if (!dep){
		return null
	}
	[...dep].forEach((effect)=> {
		// Skip triggering the current effect to prevent infinite loops
		// 這種情況到底應該throw error還是直接忽略掉？
		// 目前的做法是忽略掉
		if (effect !== currentEffect){
			effect()
		}
	})
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
					const numericDeps = [...depsMap.entries()]
						.filter(([propKey])=> isNumericKey(propKey))
					if(isFullIndexMethods){
						numericDeps.forEach(([_, dep])=> {
							dep.forEach((effect)=> {
								if (!triggeredEffects.has(effect)){
									triggeredEffects.add(effect)
									effect()
								}
							})
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
						numericDeps.forEach(([propKey, dep])=> {
							if (Number(propKey) >= startIndex){
								dep.forEach((effect)=> {
									if (!triggeredEffects.has(effect)){
										triggeredEffects.add(effect)
										effect()
									}
								})
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

class RefImpl{

	constructor(value){
		this._rawValue = value
		this._value = isObject(value) ? reactive(value) : value
		// Store effects directly on the ref object
		this.dep = new Set()
		this[IS_REF] = true
	}

	get value(){
		// Don't track if there's no current effect or if the effect is inactive
		if (currentEffect && currentEffect.__active !== false){
			this.dep.add(currentEffect)
		}
		return this._value
	}

	set value(newValue){
		if (this._rawValue === newValue){ return }
		this._rawValue = newValue
		this._value = isObject(newValue) ? reactive(newValue) : newValue
		triggerDeps(this.dep)
	}

}

const ref = (initialValue)=> {
	if (isRef(initialValue)){
		return initialValue
	}
	return new RefImpl(initialValue)
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

	// Return a read-only computed ref
	return {
		get value(){
			// Access the underlying ref to track dependencies
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
		// For both reactive and ref dependencies
		if (effectRunner){
			// We're using a null effect to prevent it from being tracked
			// and setting __active = false to stop the effect
			const originalEffect = currentEffect
			currentEffect = null
			try {
				effectRunner.__active = false
			} finally {
				currentEffect = originalEffect
			}
		}
	}
}

export {
	// don't expose reactive directly
	ref, computed, watch, isRef, isReactive,
}
