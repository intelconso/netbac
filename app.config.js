// Surcouche d'app.json, pour une seule chose : le fichier Firebase iOS.
// GoogleService-Info.plist est gitignoré (jamais poussé), donc absent d'une
// build EAS dans le cloud — EAS le fournit alors par une variable
// d'environnement de type fichier (`eas env:create --type file`
// GOOGLE_SERVICES_PLIST). En local, le fichier à la racine sert.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? config.ios?.googleServicesFile,
  },
});
