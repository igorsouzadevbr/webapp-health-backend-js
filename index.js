const express = require('express');
const https = require('https');
const http = require('http');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const fs = require('fs');
const config = require('././config.json');
const dotenv = require('dotenv');
const app = express();


const socketServer = http.createServer(app);

const bodyParser = require('body-parser');

app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.json());

const rateLimit = require('express-rate-limit');
const cors = require('cors');
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: 'Authorization,Content-Type',
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15000,
  message: "Você excedeu olimite de requisições em 15 minutos."
});

app.use('/api/', limiter);
process.env.NODE_ENV = 'development';
const ENV = /*process.env.NODE_ENV ||*/ 'development';
dotenv.config({ path: `.env.${ENV}` });

const { secretTokenKey, adminSecretTokenKey, attendantSecretTokenKey } = config;

const Login = require('./auth/login');

//import de novas funções
const Users = require('./api/user/users');
const AlterDataWithTokens = require('./api/user/alterDataWithTokens');
const AdminFunctions = require('./api/admin/functions');
const AttendantFunctions = require('./api/attendant/functions');
const System = require('./api/system');
const AttendantFlow = require('./api/chatFlow/attendantFlow');
const PatientFlow = require('./api/chatFlow/patientFlow');
const ScheduleFunctions = require('./api/schedule/scheduleFunctions');
const ScheduleLocationFunctions = require('./api/schedule/locations.js');

//import de rotas
const chatRoutes = require('./routes/chatRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const systemRoutes = require('./routes/systemRoutes');
const userRoutes = require('./routes/userRoutes');


//MYSQL CONNECTION
const connection = mysql.createPool({
  connectionLimit: 10000,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  queueLimit: 0,
  timezone: '-03:00'
});
connection.getConnection((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conexão com o banco de dados estabelecida.');
  }
});

//ROTAS DE AUTENTICAÇÃO
const clientLogin = new Login(secretTokenKey);
const adminLogin = new Login(adminSecretTokenKey);
const attendantLogin = new Login(attendantSecretTokenKey);

app.post('/api/auth', (req, res) => {
  clientLogin.login(req, res);
});
app.post('/api/admin/auth', (req, res) => {
  adminLogin.login(req, res);
});
app.post('/api/attendant/auth', (req, res) => {
  attendantLogin.login(req, res);
});

const authenticateClient = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { return res.status(401).send({ message: 'O token de autenticação fornecido é inválido.' }); }

  jwt.verify(token, secretTokenKey, (err, decoded) => {
    if (err) { return res.status(403).send({ message: 'O token de autenticação fornecido está expirado.' }); }
    next();
  });
};

const users = new Users(connection);
const adminFunctions = new AdminFunctions(connection);
const alterDataWithTokens = new AlterDataWithTokens(connection);
const attendantFunctions = new AttendantFunctions(connection);
const system = new System(connection);
const attendantFlow = new AttendantFlow(connection);
const patientFlow = new PatientFlow(connection);
const scheduleFunctions = new ScheduleFunctions(connection);
const scheduleLocationFunctions = new ScheduleLocationFunctions(connection);
const SocketConnection = require('./api/chatFlow/socketConnection');
const socketConnection = new SocketConnection(socketServer, connection);


//ROUTES
userRoutes(connection, app, users, adminFunctions, alterDataWithTokens, attendantFunctions,attendantFlow, authenticateClient, system, patientFlow);
chatRoutes(connection, app, system, attendantFlow, patientFlow, authenticateClient); 
scheduleRoutes(connection, app, system, scheduleLocationFunctions, scheduleFunctions, authenticateClient); 
systemRoutes(connection, app, system, authenticateClient);


//proteção de rotas
app.use('/api', (req, res) => {
  res.status(405).json({ message: 'Método não suportado' });
});
app.use('/api/', (req, res) => {
  res.status(405).json({ message: 'Método não suportado' });
});
app.get('/', (req, res) => {
  res.json({ message: 'Versão da API: ' + process.env.API_VERSION });
});



//turn on dos servidores

const PORT = process.env.PORT || 3000;
const portSocket = process.env.PORT_SOCKET || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ouvindo na porta:${PORT}`);
});
socketServer.listen(portSocket, '0.0.0.0', () => {
  console.log(`Servidor Socket.IO ouvindo na porta: ${portSocket}`);
});


//exporta as funções
module.exports = {
  connection, app, authenticateClient
};