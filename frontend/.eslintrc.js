module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'prettier' // Prettierとの競合を防ぐ
  ],
  plugins: ['prettier'],
  rules: {
    // console.log を警告として表示
    'no-console': 'warn',
    // 本番環境では console.log をエラーとして扱う場合は以下をコメントアウト
    // 'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    
    // その他の推奨ルール
    'no-debugger': 'warn',
    
    // Prettier ルール
    'prettier/prettier': 'error'
  }
}; 