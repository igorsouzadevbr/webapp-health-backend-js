const config = {
    development: {
        dbPort: '3306',
        dbHost: 'localhost',
        dbName: 'db_teome_dev',
        dbUser: 'root',
        dbPass: '',
        version: '0.1'
    },
    production: {
        dbPort: '3306',
        dbHost: 'localhost',
        dbName: 'db_teome_prd',
        dbUser: 'root',
        dbPass: '',
        version: '0.1'
    },
    test: {
        dbPort: '3306',
        dbHost: 'localhost',
        dbName: 'db_teome_tst',
        dbUser: 'root',
        dbPass: '',
        version: '0.1'
    }
}

module.exports = {
    config
};