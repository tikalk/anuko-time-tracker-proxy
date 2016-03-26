var express = require('express');
var http = require('request');
var app = express();
var bodyParser = require('body-parser');
var serviceUri = process.env.ANUKO_URI || 'https://timetracker.anuko.com';

app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function(request, response) {
  response.send("anuko-time-tracker-proxy");
});

app.post('/track-time', function(request, response) {
  http.post({ uri: serviceUri+'/login.php', jar: true, form: { login: request.body.login, password: request.body.password } }, 
    function(err, loginResponse) {
      if(err) { console.log(err); response.status(500).send('An error has occured. Please check the log for details.'); return; }
      if(loginResponse.statusCode > 399) { response.status(500).send('anuko login failed'); console.log(loginResponse); return; }
      http.get({ uri: serviceUri+'/projects.php', jar: true },
        function(err, projectsResponse) {

          if(err) { console.log(err); response.status(500).send('An error has occured. Please check the log for details.'); return; }
          if(projectsResponse.statusCode > 399) { response.status(500).send('anuko project listing failed'); console.log(projectsResponse); return; }
          var projectLabelOffset = projectsResponse.body.indexOf("<td>"+request.body.project+"</td>");

          if(projectLabelOffset === -1) { response.status(400).send('invalid project name'); return; }
          var projectIdOffset = projectsResponse.body.indexOf('id=', projectLabelOffset);
          var projectIdEndOffset = projectsResponse.body.indexOf('"', projectIdOffset);
          var projectId = projectsResponse.body.substring(projectIdOffset+3, projectIdEndOffset);
          
          http.get({ uri: serviceUri+'/time.php', jar: true },
            function(err, tasksResponse) {

            var r = new RegExp('^\\s+task_names\\[(\\d+)\\] = "' + request.body.task + '";$', 'm');
            var tmp = tasksResponse.body.match(r);

            if (tmp === null) { response.status(400).send('invalid task name'); return; }

            var taskId = tmp[1];

            http.post({ uri: serviceUri+'/time.php', jar: true, form: {
                project: projectId,
                task: taskId,
                start: request.body.start,
                finish: request.body.finish,
                duration: request.body.duration,
                date: request.body.date,
                note: request.body.note,
                btn_submit: 'Submit',
                browser_today: request.body.date
              }, qs: { date: request.body.date }}, function(err, timeResponse) {
                if(err) { console.log(err); response.status(500).send('An error has occured. Please check the log for details.'); return; }
                if(timeResponse.statusCode > 399) { response.status(500).send('anuko time track failed'); console.log(timeResponse); return; }
                response.send('time tracked');
              });
            });
        });
    });
});

app.listen(app.get('port'), function() {
  console.log('anuko-time-tracker-proxy is running on port', app.get('port'));
});


