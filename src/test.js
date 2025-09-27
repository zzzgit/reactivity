import { computed, isRef, ref, watch } from './vue.js'
import { assert, describe, it, printFailedTestSummary } from './utils.js'

console.log('Starting reactive system tests...\n')

// ref feature test
describe('ref', ()=> {
	it('should create a reactive reference', ()=> {
		const myRef = ref(10)
		assert(myRef.value === 10, 'ref initial value should be 10')
	})

	it('should be able to update the value', ()=> {
		const myRef = ref(5)
		myRef.value = 15
		assert(myRef.value === 15, 'ref value should be updatable')
	})

	it('should handle refs of refs by unwrapping them', ()=> {
		const obj = { a: 3 }
		const wrapped = ref(obj)
		const newWrapped = ref(wrapped)

		// Test isRef function
		assert(isRef(wrapped), 'isRef should identify ref objects')
		assert(isRef(newWrapped), 'isRef should identify ref objects')
		assert(!isRef(obj), 'isRef should return false for non-ref objects')
		assert(!isRef(5), 'isRef should return false for primitives')

		// newWrapped should be the same object as wrapped according to Vue 3 behavior
		assert(newWrapped === wrapped, 'ref of a ref should return the original ref')
		assert(newWrapped.value.a === 3, 'should access value directly without double unwrapping')

		// Test updating the ref value
		wrapped.value.a = 5
		assert(newWrapped.value.a === 5, 'changes should be reflected in the ref')

		// Test that they are truly the same object
		newWrapped.value = { a: 7 }
		assert(wrapped.value.a === 7, 'changing value through returned ref should update original ref')
		assert(wrapped.value !== obj, 'original object should no longer be the referenced object')
	})

	it('should trigger side effects', ()=> {
		const myRef = ref(0)
		const myComputed = computed(()=> myRef.value * 2)

		assert(myComputed.value === 0, 'computed should get the initial value')

		myRef.value = 10
		assert(myComputed.value === 20, 'computed should be updated when ref changes')
	})

	it('should handle objects', ()=> {
		const myRef = ref({ a: 1, b: { c: 2 } })
		const myComputed = computed(()=> myRef.value.a + myRef.value.b.c)

		assert(myComputed.value === 3, 'computed should work with object properties')

		myRef.value.a = 10
		assert(myComputed.value === 12, 'computed should react to property changes')

		myRef.value.b.c = 20
		assert(myComputed.value === 30, 'computed should react to nested property changes')

		myRef.value = { a: 1, b: { c: 2 } }
		assert(myComputed.value === 3, 'computed should react to object reassignment')
	})
})

// computed feature test
describe('computed', ()=> {
	it('should create a computed property', ()=> {
		const myRef = ref(5)
		const myComputed = computed(()=> myRef.value * 2)
		assert(myComputed.value === 10, 'computed property should return the correct result')
	})

	it('should react to dependency changes', ()=> {
		const myRef = ref(3)
		const myComputed = computed(()=> myRef.value * 3)

		assert(myComputed.value === 9, 'initial computed value should be correct')

		myRef.value = 4
		assert(myComputed.value === 12, 'computed value should update after dependency change')
	})

	it('should support complex computations', ()=> {
		const a = ref(2)
		const b = ref(3)
		const sum = computed(()=> a.value + b.value)
		const product = computed(()=> sum.value * 2)

		assert(sum.value === 5, 'sum computation should be correct')
		assert(product.value === 10, 'product computation should be correct')

		a.value = 5
		assert(sum.value === 8, 'sum should be correct after update')
		assert(product.value === 16, 'product should be correct after update')
	})
})

// watch feature test
describe('watch', ()=> {
	it('should watch for ref value changes', ()=> {
		const myRef = ref(1)
		let watchedValue = null
		let callCount = 0

		watch(myRef, (newValue)=> {
			watchedValue = newValue
			callCount++
		})

		assert(callCount === 0, 'watch callback should not be called immediately by default')

		myRef.value = 2
		assert(watchedValue === 2, 'watch should have picked up the new value')
		assert(callCount === 1, 'watch callback should have been called once')
	})

	it('should watch for computed value changes', ()=> {
		const myRef = ref(10)
		const myComputed = computed(()=> myRef.value * 2)
		let watchedValue = null

		watch(myComputed, (newValue)=> {
			watchedValue = newValue
		})

		myRef.value = 15
		assert(watchedValue === 30, 'watch should have picked up the computed change')
	})

	it('should support a function as a source', ()=> {
		const myRef = ref(5)
		let watchedValue = null

		watch(()=> myRef.value * 2, (newValue)=> {
			watchedValue = newValue
		})

		myRef.value = 8
		assert(watchedValue === 16, 'watch should support a function as a source')
	})

	it('should watch for reactive object property changes', ()=> {
		const myReactive = ref({ a: 1, b: { c: 2 } })
		let watchedValue = null
		let oldValue = null
		let callCount = 0

		watch(()=> myReactive.value.a, (newValue, prevValue)=> {
			watchedValue = newValue
			oldValue = prevValue
			callCount++
		})

		assert(callCount === 0, 'watch on object property should not be called immediately')

		myReactive.value.a = 10
		assert(watchedValue === 10, 'watch should pick up property change')
		assert(oldValue === 1, 'watch should provide the old value')
		assert(callCount === 1, 'watch callback should be called once for property change')
	})

	it('should watch for nested reactive object property changes', ()=> {
		const myReactive = ref({ a: 1, b: { c: 2 } })
		let watchedValue = null
		let oldValue = null
		let callCount = 0

		watch(()=> myReactive.value.b.c, (newValue, prevValue)=> {
			watchedValue = newValue
			oldValue = prevValue
			callCount++
		})

		assert(callCount === 0, 'watch on nested property should not be called immediately')

		myReactive.value.b.c = 20
		assert(watchedValue === 20, 'watch should pick up nested property change')
		assert(oldValue === 2, 'watch should provide the old value for nested property')
		assert(callCount === 1, 'watch callback should be called once for nested property change')
	})
})

// Combined feature test
describe('Combined Features', ()=> {
	it('should support complex reactive chains', ()=> {
		const count = ref(1)
		const doubled = computed(()=> count.value * 2)
		const quadrupled = computed(()=> doubled.value * 2)

		let watchResult = null
		watch(quadrupled, (newValue)=> {
			watchResult = newValue
		})

		assert(doubled.value === 2, 'doubled should be correct')
		assert(quadrupled.value === 4, 'quadrupled should be correct')

		count.value = 3
		assert(doubled.value === 6, 'doubled should be correct after update')
		assert(quadrupled.value === 12, 'quadrupled should be correct after update')
		assert(watchResult === 12, 'watch should have picked up the final result')
	})

	it('should handle updates with the same value', ()=> {
		const myRef = ref(10)
		const myComputed = computed(()=> myRef.value * 2)

		// Set the same value
		myRef.value = 10

		// Since the implementation has a check for the same value, no change should be triggered
		assert(myRef.value === 10, 'value should remain the same after same-value update')
		assert(myComputed.value === 20, 'computed value should not change')

		// Test update with a different value
		myRef.value = 20
		assert(myRef.value === 20, 'different value update should work correctly')
		assert(myComputed.value === 40, 'computed value should update with new value')
	})
})

// ref with array
describe('ref with array', ()=> {
	it('should create a reactive array', ()=> {
		const myArray = ref([1, 2, 3])
		assert(Array.isArray(myArray.value), 'ref should hold an array')
		assert(myArray.value.length === 3, 'initial array length should be correct')
	})

	it('should react to array element changes', ()=> {
		const myArray = ref([1, 2, 3])
		const myComputed = computed(()=> myArray.value[0] + myArray.value[2])
		assert(myComputed.value === 4, 'computed should work with initial array elements')

		myArray.value[0] = 10
		assert(myComputed.value === 13, 'computed should react to element change')
	})

	it('should react to array length changes with push', ()=> {
		const myArray = ref([1, 2])
		const myComputed = computed(()=> myArray.value.length)
		assert(myComputed.value === 2, 'initial length is correct')

		myArray.value.push(3)
		assert(myComputed.value === 3, 'computed should react to push')
	})

	it('should react to array length changes with pop', ()=> {
		const myArray = ref([1, 2, 3])
		const myComputed = computed(()=> myArray.value.length)
		assert(myComputed.value === 3, 'initial length is correct')

		myArray.value.pop()
		assert(myComputed.value === 2, 'computed should react to pop')
	})

	it('should react to array content changes with splice', ()=> {
		const myArray = ref([1, 2, 3, 4])
		const myComputed = computed(()=> myArray.value.join(','))
		assert(myComputed.value === '1,2,3,4', 'initial computed is correct')

		// replaces 2,3 with 5,6 -> [1, 5, 6, 4]
		myArray.value.splice(1, 2, 5, 6)
		assert(myComputed.value === '1,5,6,4', 'computed should react to splice')
	})

	it('should watch for array changes', ()=> {
		const myArray = ref([1])
		let watchedLength = -1

		watch(()=> myArray.value.length, (newLength)=> {
			watchedLength = newLength
		})

		myArray.value.push(2)
		assert(watchedLength === 2, 'watch should pick up array length change')
	})
})

printFailedTestSummary()
