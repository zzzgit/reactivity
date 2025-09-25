export const isObject = val=> val !== null && typeof val === 'object'
export const isNumericKey = val=> !isNaN(Number(val))

const assert = (condition, message)=> {
	if (!condition){
		throw new Error(`Assertion failed: ${message}`)
	}
	console.log(`✓ ${message}`)
}

const describe = (suiteName, testSuite)=> {
	console.log(`\n=== ${suiteName} ===`)
	try{
		testSuite()
		console.log(`✓ All tests passed for ${suiteName}`)
	}catch(error){
		console.error(`✗ Test failed in ${suiteName}:`, error.message)
	}
}

const it = (testName, testFn)=> {
	try{
		testFn()
		console.log(`  ✓ ${testName}`)
	}catch(error){
		console.error(`  ✗ ${testName}: ${error.message}`)
		throw error
	}
}

export {
	assert, describe, it,
}
