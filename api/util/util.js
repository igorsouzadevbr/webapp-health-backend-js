// Utilidades para projetos diversos.
// Developed by Igor Souza <igor@cadenzatecnologia.com.br>


const crypto = require('crypto');


function isPhoneNumber(phoneNumber) {
  const numericPhoneNumber = phoneNumber.replace(/\D/g, '');
  const isValidLength = numericPhoneNumber.length === 11;

  const hasRepeatedDigits = /^\d*(\d)\1{9}\d*$/.test(numericPhoneNumber);

  return isValidLength && !hasRepeatedDigits;
}

function formatPhoneNumber(phoneNumber) {
  const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
  const match = cleanedPhoneNumber.match(/^(\d{2})(\d)(\d{4})(\d{4})$/);

  if (match) {
    const formattedPhoneNumber = `(${match[1]}) ${match[2]} ${match[3]}-${match[4]}`;
    return formattedPhoneNumber;
  }
  return phoneNumber;
}

const formatToDate = (data) => {
  if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(data)) {
    return data;
  }
  else if (/^(\d{2})(\d{2})(\d{4})$/.test(data)) {
    return data.replace(/^(\d{2})(\d{2})(\d{4})$/, "$1/$2/$3");
  }
  else if (/^(\d{2})-(\d{2})-(\d{4})$/.test(data)) {
    return data.replace(/^(\d{2})-(\d{2})-(\d{4})$/, "$1/$2/$3");
  }
  else {
    return data;
  }
}
const secretKey = 'S7cNs7cwhBZ0VCJcwfCQ69bAuaBmyeS9';
function convertToSHA256(text) {
  const cipher = crypto.createCipher('aes-256-cbc', secretKey);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}
function decryptSHA256(encryptedText) {
  const decipher = crypto.createDecipher('aes-256-cbc', secretKey);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function isOnlyNumbers(field) {
  return /^[0-9]+$/.test(field);
}

function isInteger(value) {
  return Number.isInteger(value);
}

function isEmail(text) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(text);
}

function isUnformattedCPF(cpfNumber) {
  const numericcpfNumber = cpfNumber.replace(/\D/g, '');
  const isValidLength = numericcpfNumber.length === 11;

  const hasRepeatedDigits = /^\d*(\d)\1{9}\d*$/.test(numericcpfNumber);

  return isValidLength && !hasRepeatedDigits;
}

function formatCPF(cpf) {
  const cleanedCPF = cpf.replace(/\D/g, '');
  const match = cleanedCPF.match(/^(\d{3})(\d{3})(\d{3})(\d{2})$/);
  if (match) {
    const formattedCPF = `${match[1]}.${match[2]}.${match[3]}-${match[4]}`;
    return formattedCPF;
  }
  return cpf;
}

function isCNPJ(cnpj) {
  const cnpjNumeric = cnpj.replace(/\D/g, '');
  const isValidLength = cnpjNumeric.length === 14;

  const hasRepeatedDigits = /^\d*(\d)\1{9}\d*$/.test(cnpjNumeric);

  return isValidLength && !hasRepeatedDigits;
}

async function getCityNameById(cityId, connection) {
  const databaseFramework = new dbUtils(connection);
  const cityData = await databaseFramework.select("city", "name", "id = ?", [cityId]);
  return cityData.length > 0 ? cityData[0].name : null;
}

async function getStateNameById(stateId, connection) {
  const databaseFramework = new dbUtils(connection);
  const stateData = await databaseFramework.select("states", "nome", "id = ?", [stateId]);
  return stateData.length > 0 ? stateData[0].nome : null;
}

function validaURL(str) {
  const pattern = new RegExp('^(https?:\\/\\/)?' +
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
    '((\\d{1,3}\\.){3}\\d{1,3}))' +
    '(\\:\\d+)?' +
    '(\\/[-a-z\\d%_.~+]*)*' +
    '(\\?[;&a-z\\d%_.~+=-]*)?' +
    '(\\#[-a-z\\d_]*)?$', 'i');
  return !!pattern.test(str);
}

async function validaCEP(cep) {
  try {
    const axios = require('axios');
    const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
    if (response.data.erro) {
      return {
        valido: false
      };
    } else {
      return {
        valido: true,
        cep: response.data.cep,
        logradouro: response.data.logradouro,
        complemento: response.data.complemento,
        bairro: response.data.bairro,
        localidade: response.data.localidade,
        uf: response.data.uf,
        ibge: response.data.ibge
      };
    }
  } catch (error) {
    return {
      valido: false
    };
  }
}

function validaHora(timeValue) {
  const pattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  return pattern.test(timeValue);
}

function getWeekDay(weekday) {
  switch (weekday) {
    case "0":
      return "Domingo";
    case "1":
      return "Segunda";
    case "2":
      return "Terça";
    case "3":
      return "Quarta";
    case "4":
      return "Quinta";
    case "5":
      return "Sexta";
    case "6":
      return "Sábado";
    default:
      return "Dia inválido";
  }
}

async function validateCityById(cityId, connection) {
  const databaseFramework = new dbUtils(connection);
  const getCities = await databaseFramework.select("city", "id", "id = ? and isDeleted = 0", [cityId]);
  return new Promise((resolve, reject) => {
    resolve(getCities.length > 0);
  });
}
async function validateStateById(stateId, connection) {
  const databaseFramework = new dbUtils(connection);
  const getStates = await databaseFramework.select("states", "id", "id = ? and isDeleted = 0", [stateId]);
  return new Promise((resolve, reject) => {
    resolve(getStates.length > 0);
  });
}

function generateToken() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  let token = '';

  // Adiciona 3 letras aleatórias ao token
  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(Math.random() * letters.length);
    token += letters[randomIndex];
  }

  // Adiciona 4 números aleatórios ao token
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * numbers.length);
    token += numbers[randomIndex];
  }

  return token;
}

function isBlob(data) {
  return data instanceof Buffer;
}

function isValidUUID(uuid) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

const dbUtils = require('../util/databaseUtils.js');
const { stat } = require('fs');
async function logToDatabase(logData, connection) {
  const databaseFramework = new dbUtils(connection);
  const dataAtual = new Date();
  await databaseFramework.insert("apilogrequests", { uniqueid: logData.uniqueid, ip: logData.ip, method: logData.method, message: logData.message, status: logData.status, datetime: dataAtual });


}

function convertDateToCustomFormat(isoDate) {
  const dateObject = new Date(isoDate);

  if (isNaN(dateObject.getTime())) {
    return 'Data inválida';
  }

  const year = dateObject.getFullYear();
  const month = (dateObject.getMonth() + 1).toString().padStart(2, '0'); // +1 porque os meses são zero-based
  const day = dateObject.getDate().toString().padStart(2, '0');

  return `${day}/${month}/${year}`;
}

function addHoursToTime(time, hours) {
  const timeParts = time.split(":");
  const date = new Date();
  date.setHours(parseInt(timeParts[0]) + hours, parseInt(timeParts[1]), 0);

  return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
}

function formatDate(dateInput) {
  // Verifica se o input é um objeto Date
  if (dateInput instanceof Date) {
    return `${dateInput.getDate().toString().padStart(2, '0')}/${(dateInput.getMonth() + 1).toString().padStart(2, '0')}/${dateInput.getFullYear()}`;
  }
  // Caso contrário, trata como uma string
  else if (typeof dateInput === 'string') {
    const dateParts = dateInput.split("-");
    return `${dateParts[2].split('T')[0]}/${dateParts[1]}/${dateParts[0]}`;
  }
  // Retorna uma string vazia ou algum valor padrão se o input não for nem Date nem string
  else {
    return "";
  }
}



module.exports = {
  isPhoneNumber, formatPhoneNumber, convertToSHA256, isInteger, isEmail, formatCPF, isUnformattedCPF, isCNPJ, validaURL, validaCEP, validaHora, getWeekDay, logToDatabase, formatToDate, validateCityById, validateStateById, generateToken, isBlob, decryptSHA256, isValidUUID, isOnlyNumbers, convertDateToCustomFormat, addHoursToTime, formatDate, getCityNameById, getStateNameById
};
