import js from 'eslint-config-janus/js.js'
import globals from 'globals'

export default [
	...js,
	{
		languageOptions: {
			parserOptions: {
				sourceType: 'module',
			},
			globals: {
				chrome: 'readonly',
				// ...globals.node,
				...globals.browser,
			},
		},
		rules: {

		},
	},
]
