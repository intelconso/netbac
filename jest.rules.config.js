// Tests des règles Firestore, contre l'émulateur — à part de la suite
// principale (jest-expo) parce qu'ils tournent en Node et demandent
// l'émulateur. Lancer : npm run test:rules
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/rules-tests/**/*.test.js'],
};
