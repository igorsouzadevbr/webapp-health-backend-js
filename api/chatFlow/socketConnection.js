const socketIO = require('socket.io');
const dbUtils = require('../util/databaseUtils.js');
const utils = require('../util/util.js');
const attendantFlow = require('../chatFlow/attendantFlow.js');

class SocketConnection {
  constructor(server, connection) {
    this.io = socketIO(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.connection = connection;
    this.users = [];
    this.queue = [];

    this.io.on('connection', (socket) => {
      console.log(`Socket conectado: ${socket.id}`);

      // Lógica para manipular mensagens recebidas do cliente
      socket.on('message', (data) => {
        console.log(`Mensagem recebida: ${data}`);

        // Enviar a mensagem de volta para todos os clientes conectados
        this.io.emit('message', data);
      });

      // Lógica para lidar com desconexões de cliente
      socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
      });

    });

    setInterval(() => {

    }, 5000);
  }

  async checkQueue() {
    const databaseFramework = new dbUtils(this.connection);
    const getAttendantFlow = new attendantFlow(this.connection);
    try {
      const getAllAtendantsOnQueue = await getAttendantFlow.getAllAttendantsFromDB();

    } catch (error) {

    }
  }

}

module.exports = SocketConnection;
