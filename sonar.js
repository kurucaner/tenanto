const { scan } = require("sonarqube-scanner");

scan({
  serverUrl: "http://localhost:9002",
  options: {
    "sonar.projectKey": "propertyos",
    "sonar.login": "sqp_ef6439a98c75ec8e294772a60199c81332c75d54",
    "sonar.sources": ".",
    "sonar.exclusions": "**/node_modules/**,**/dist/**,**/.next/**,**/apps/server/templates/**",
  },
})
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
