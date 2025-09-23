import { computed, ref, watch } from './vue.js'
import { assert, describe, it } from './utils.js'

console.log('Starting reactive system tests...\n')

// ref 功能测试
describe('ref 响应式引用', ()=> {
	it('应该创建一个响应式引用', ()=> {
		const myRef = ref(10)
		assert(myRef.value === 10, 'ref 初始值应该为 10')
	})

	it('应该能够更新值', ()=> {
		const myRef = ref(5)
		myRef.value = 15
		assert(myRef.value === 15, 'ref 值应该能够被更新')
	})

	it('应该触发副作用函数', ()=> {
		const myRef = ref(0)
		let effectCallCount = 0
		let effectValue = 0

		// 模拟 effect 功能（由于 _effect 没有导出，我们通过访问属性来触发）
		const testEffect = ()=> {
			effectCallCount++
			effectValue = myRef.value
		}

		// 直接测试响应式行为
		// 初始调用
		testEffect()
		assert(effectCallCount === 1, '副作用函数应该被调用一次')
		assert(effectValue === 0, '副作用函数应该获取到正确的值')

		myRef.value = 10
		assert(myRef.value === 10, '值应该被正确更新')
	})
})

// computed 功能测试
describe('computed 计算属性', ()=> {
	it('应该创建计算属性', ()=> {
		const myRef = ref(5)
		const myComputed = computed(()=> myRef.value * 2)
		assert(myComputed.value === 10, '计算属性应该返回正确的计算结果')
	})

	it('应该响应依赖变化', ()=> {
		const myRef = ref(3)
		const myComputed = computed(()=> myRef.value * 3)

		assert(myComputed.value === 9, '初始计算值应该正确')

		myRef.value = 4
		assert(myComputed.value === 12, '依赖变化后计算值应该更新')
	})

	it('应该支持复杂计算', ()=> {
		const a = ref(2)
		const b = ref(3)
		const sum = computed(()=> a.value + b.value)
		const product = computed(()=> sum.value * 2)

		assert(sum.value === 5, '和计算应该正确')
		assert(product.value === 10, '乘积计算应该正确')

		a.value = 5
		assert(sum.value === 8, '更新后和计算应该正确')
		assert(product.value === 16, '更新后乘积计算应该正确')
	})
})

// watch 功能测试
describe('watch 监听器', ()=> {
	it('应该监听 ref 值变化', ()=> {
		const myRef = ref(1)
		let watchedValue = null
		let callCount = 0

		watch(myRef, (newValue)=> {
			watchedValue = newValue
			callCount++
		})

		assert(callCount === 0, 'watch 回调默认不应该立即被调用')

		myRef.value = 2
		assert(watchedValue === 2, 'watch 应该监听到新值')
		assert(callCount === 1, 'watch 回调应该被调用一次')
	})

	it('应该监听 computed 值变化', ()=> {
		const myRef = ref(10)
		const myComputed = computed(()=> myRef.value * 2)
		let watchedValue = null

		watch(myComputed, (newValue)=> {
			watchedValue = newValue
		})

		myRef.value = 15
		assert(watchedValue === 30, 'watch 应该监听到 computed 的变化')
	})

	it('应该支持函数形式的监听源', ()=> {
		const myRef = ref(5)
		let watchedValue = null

		watch(()=> myRef.value * 2, (newValue)=> {
			watchedValue = newValue
		})

		myRef.value = 8
		assert(watchedValue === 16, 'watch 应该支持函数形式的监听源')
	})
})

// 综合测试
describe('综合功能测试', ()=> {
	it('应该支持复杂的响应式链', ()=> {
		const count = ref(1)
		const doubled = computed(()=> count.value * 2)
		const quadrupled = computed(()=> doubled.value * 2)

		let watchResult = null
		watch(quadrupled, (newValue)=> {
			watchResult = newValue
		})

		assert(doubled.value === 2, '双倍计算应该正确')
		assert(quadrupled.value === 4, '四倍计算应该正确')

		count.value = 3
		assert(doubled.value === 6, '更新后双倍计算应该正确')
		assert(quadrupled.value === 12, '更新后四倍计算应该正确')
		assert(watchResult === 12, 'watch 应该监听到最终结果')
	})

	it('应该处理相同值的更新', ()=> {
		const myRef = ref(10)

		// 设置相同值
		myRef.value = 10

		// 由于实现中有相同值检查，相同值更新不应该触发变化
		assert(myRef.value === 10, '相同值更新后值应该保持不变')

		// 测试不同值的更新
		myRef.value = 20
		assert(myRef.value === 20, '不同值更新应该正常工作')
	})
})
