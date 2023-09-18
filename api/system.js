class System {
    constructor(connection) {
        this.connection = connection;
      }

      getUserTypes(req, res) {
        this.connection.getConnection((err, connection) => {
        if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 
        
        connection.query("SELECT * FROM usertype", (err, results) => {
          connection.release();
            if (err) {
              console.error('Erro no método getUserTypes, query n° 1:', err);
              return res.sendStatus(500);
            }
            if (results.length === 0) {
              return res.status(404).json({ message: 'Sem resultados.'});     
            }
            res.status(200).send({ results });
          });
        }); 
      }
      getCityByID(req, res) {
        const cityid = req.params.cityid;
        this.connection.getConnection((err, connection) => {
        if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 

        connection.query('SELECT * FROM city where id = ? and IsDeleted = 0', [cityid], (err, results) => {
          connection.release();
            if (err) {
              console.error('Erro no método getCityByID, query n° 1:', err);
              return res.sendStatus(500);
            }
            if (results.length === 0) {
              return res.status(404).json({ message: 'Sem resultados.'});     
            }
            res.status(200).send({ results });

          });
          });
      }
      getCityByName(req, res) {
        const cityname = req.params.cityname
        this.connection.getConnection((err, connection) => {
          if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 

        connection.query('SELECT * FROM city WHERE name = ? and IsDeleted = 0', [cityname], (err, results) => {
          connection.release();
            if (err) {
              console.error('Erro no método getCityByName, query n° 1:', err);
              return res.sendStatus(500);
            }
            
            if (results.length === 0) {
              return res.status(404).json({ message: 'Sem resultados.'});     
            }
            res.status(200).send({ results });

          });
        });
      }
      getStateByID(req, res) {
        const stateid = req.params.stateid;
        this.connection.getConnection((err, connection) => {
          if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 

        connection.query('SELECT * FROM states where id = ? and IsDeleted = 0', [stateid], (err, results) => {
          connection.release();
            if (err) {
              console.error('Erro no método getStateByID, query n° 1:', err);
              return res.sendStatus(500);
            }
            if (results.length === 0) {
              return res.status(404).json({ message: 'Sem resultados.'});     
            }
            res.status(200).send({ results });
            
          });
        });
      }
      getStateByAb(req, res) {
        const stateab = req.params.stateab;
        this.connection.getConnection((err, connection) => {
          if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 

        connection.query('SELECT * FROM states where tag = ? and IsDeleted = 0', [stateab], (err, results) => {
          connection.release();
            if (err) {
              console.error('Erro no método getStateByAb, query n° 1:', err);
              return res.sendStatus(500);
            }
            if (results.length === 0) {
              return res.status(404).json({ message: 'Sem resultados.'});     
            }
            res.status(200).send({ results });
          
          });
        });
      }
      getStateByName(req, res) {
        const statename = req.params.statename
        this.connection.getConnection((err, connection) => {
          if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 

        connection.query('SELECT * FROM states WHERE nome = ? and IsDeleted = 0', [statename], (err, results) => {
          connection.release();
            if (err) {
              console.error('Erro no método getStateByName, query n° 1:', err);
              return res.sendStatus(500);
            }
            
            if (results.length === 0) {
              return res.status(404).json({ message: 'Sem resultados.'});     
            }
            res.status(200).send({ results });
          });
          });
      }
      getGenderByID(req, res) {
        const genderid = req.params.genderid;
        this.connection.getConnection((err, connection) => {
          if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 

        connection.query('SELECT * FROM gender where id = ?', [genderid], (err, results) => {
          connection.release();
            if (err) {
              console.error('Erro no método getGenderByID, query n° 1:', err);
              return res.sendStatus(500);
            }
            if (results.length === 0) {
              return res.status(404).json({ message: 'Sem resultados.'});     
            }
            res.status(200).send({ results });
            
          });
        });
      }
      getGenderByName(req, res) {
        const gendername = req.params.gendername;
        this.connection.getConnection((err, connection) => {
          if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 

        connection.query('SELECT * FROM gender where Name = ?', [gendername], (err, results) => {
          connection.release();
            if (err) {
              console.error('Erro no método getGenderByName, query n° 1:', err);
              return res.sendStatus(500);
            }
            if (results.length === 0) {
              return res.status(404).json({ message: 'Sem resultados.'});     
            }
            res.status(200).send({ results });
          
          });
        });
      }
    }
    module.exports = System;