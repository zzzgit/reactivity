export const isObject = val=> val !== null && typeof val === 'object'
export const isNumericKey = val=> !isNaN(Number(val))

const failedTests = []

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
		failedTests.push({
			suite: suiteName,
			error: error.message,
		})
	}
}

const it = (testName, testFn)=> {
	try{
		testFn()
		console.log(`  ✓ ${testName}`)
	}catch(error){
		console.error(`  ✗ ${testName}: ${error.message}`)
		failedTests.push({
			suite: 'current',
			test: testName,
			error: error.message,
		})
		throw error
	}
}

const printFailedTestSummary = ()=> {
	if (failedTests.length === 0){
		console.log('\n✅ All tests passed successfully!')
		return
	}

	console.log('\n📋 Failed Tests Summary 📋')
	console.log('=============================')

	failedTests.forEach((failure, index)=> {
		console.log(`${index + 1}. Suite: ${failure.suite}`)
		if (failure.test){
			console.log(`   Test: ${failure.test}`)
		}
		console.log(`   Error: ${failure.error}`)
		console.log('-----------------------------')
	})

	console.log(`❌ ${failedTests.length} test(s) failed in total`)
}

export {
	assert, describe, it, printFailedTestSummary,
}
