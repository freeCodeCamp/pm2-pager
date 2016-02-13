require('dotenv').load();
var pm2 = require('pm2');
var nodemailer = require('nodemailer');
var moment = require('moment-timezone');
var _ = require('lodash');

var mailReceiver = process.env.MAIL_RECEIVER || false;
var mailSender = process.env.MAIL_SENDER;
var user = process.env.MANDRILL_USER || false;
var pass = process.env.MANDRILL_PASSWORD;

if (!mailReceiver || !user || !pass) {
  throw new Error('User || pass || receiver not specified');
}

var transportOptions = {
  type: 'smtp',
  service: 'Mandrill',
  auth: {
    user: user,
    pass: pass
  }
};

var transporter = nodemailer.createTransport(transportOptions);

pm2.connect(function(err) {
  if (err) { throw err; }
  console.log('connected to pm2');
  console.log('setting up exception event listener');

  var compiled = _.template(
    'An error has occurred on server ' +
    '<% name %>\n' +
    'Stack Trace:\n\n\n<%= stack %>\n\n\n' +
    'Context:\n\n<%= text %>'
  );

  pm2.launchBus(function(err, bus) {
    if (err) { throw err; }

    console.log('event bus connected');

    bus.on('process:exception', function(data) {
      var text;
      var stack;
      var name;
      try {
        data.date = moment(data.at || new Date())
          .tz('America/Los_Angeles')
          .format('MMMM Do YYYY, h:mm:ss a z');

        text = JSON.stringify(data, null, 2);
        stack = data.data.stack;
        name = data.process.name;
      } catch (e) {
        console.error('Error parsing exception' + e);
        return e;
      }

      transporter.sendMail({
        to: mailReceiver,
        from: mailSender || user + '@yourserver.com',
        subject: 'Server exception',
        text: compiled({ name: name, text: text, stack: stack })
      });
    });
  });
});
