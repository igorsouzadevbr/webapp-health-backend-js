// Utilidades para projetos diversos.
// Developed by Igor Souza <igor@cadenzatecnologia.com.br>


const crypto = require('crypto');
const main = require('../../index.js');

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


  function convertToSHA256(password) {
    return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
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

  function validaURL(str) {
    const pattern = new RegExp('^(https?:\\/\\/)?'+
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+
        '((\\d{1,3}\\.){3}\\d{1,3}))'+
        '(\\:\\d+)?'+
        '(\\/[-a-z\\d%_.~+]*)*'+
        '(\\?[;&a-z\\d%_.~+=-]*)?'+
        '(\\#[-a-z\\d_]*)?$','i');
    return !!pattern.test(str);
}
   async function validaCEP(cep) {
    try {
        const axios = require('axios');
        const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
        if (response.data.erro) {
            console.log('CEP inválido');
            return false;
        } else {
            console.log('CEP válido');
            return true;
        }
    } catch (error) {
        console.log('Erro ao validar CEP:', error);
        return false;
    }
}
function validaHora(timeValue) {
  const pattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  return pattern.test(timeValue);
}

function getWeekDay(weekday) {
    console.log('Recebido: ' + weekday);
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

  function logToDatabase(logData) {
    const query = 'INSERT INTO apilogrequests (uniqueid, ip, method, message, status, datetime) VALUES (?, ?, ?, ?, ?, NOW())';
    const values = [logData.uniqueid, logData.ip, logData.method, logData.message, logData.status];
      
    main.connection.getConnection((err, connection) => {
    if (err) {console.error('Erro ao conectar ao banco de dados:', err.message); return;} 
    
      connection.query(query, values, (error, results) => {
      connection.release();
      if (error) {
        console.error('Erro ao registrar log:', error);
        return;
      }
      console.log('Log registrado com sucesso:', results.insertId);
    });
  });
  }

  module.exports = {
    isPhoneNumber, formatPhoneNumber, convertToSHA256, isInteger, isEmail, formatCPF, isUnformattedCPF, isCNPJ, validaURL, validaCEP, validaHora, getWeekDay, logToDatabase, formatToDate
  };
