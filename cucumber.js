// Escenarios BDD (Gherkin) del chat, ejecutados con Cucumber + Playwright (Chromium).
// Ejecutar: npm run test:bdd   (levanta el chat por su cuenta; usa la variable PORT, por defecto 3000)
module.exports = {
  default: {
    paths: ['tests/bdd/features/**/*.feature'],
    require: ['tests/bdd/support/**/*.js', 'tests/bdd/steps/**/*.js'],
    format: ['summary', 'json:test-results/bdd-report.json'],
    publishQuiet: true,
  },
};
