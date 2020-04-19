function send_invitation(event) {
  Logger.log('send_invitation event');
  var today = get_day_of_week();
  var form = prepare_form(today);
  var form_url = form.getPublishedUrl();
  invitation_sender(form_url);
  var trig_day = (today == 'Monday') ? ScriptApp.WeekDay.MONDAY : ScriptApp.WeekDay.FRIDAY;
  set_trigger(today, trig_day, 16, 'send_results');
}

function send_results(event) {
  Logger.log('send_results event');
  var entries = get_form_responses();
  if (entries.length) {
    record_entries(entries);
    var results = parse_results(entries);
    var email_body = prepare_results_email(results);
    results_sender(email_body);
  }
  var today = get_day_of_week();
  var next_trig_day = (today == 'Monday') ? ScriptApp.WeekDay.FRIDAY : ScriptApp.WeekDay.MONDAY;
  set_trigger(today, next_trig_day, 7, 'send_invitation');
}

function prepare_form(day) {
  var form = form_initializer(get_id('form_id'));
  var static_questions = get_static_questions(day);
  static_questions.forEach(function(q) {
    form_add_question(form, q[0], q[1]);
  });
  //pull one-off questions from the "add question" form
  var dynamic_questions = get_dynamic_questions(day);
  dynamic_questions.forEach(function(q) {
    form_add_question(form, q[0], q[1]);
  });
  return form;
}

function form_initializer(form_id) {
  var form;
  try {
    form = FormApp.openById(form_id);
    clear_form(form);
  } catch(err) {
    Logger.log(err);
    Logger.log('creating new form.');
    form = FormApp.create('InSync');
    //update form_id in registry
    set_id('form_id', form.getId());
  } finally {
    form.setDescription('Say bye bye bye to meetings.');
    form.setRequireLogin(true);
    form.setCollectEmail(true);
    form.setAllowResponseEdits(true);
    Logger.log('published URL: ' + form.getPublishedUrl());
    Logger.log('editor URL: ' + form.getEditUrl());
  }
  return form;
}

function get_day_of_week(d) {
  if (d == undefined) {
    d = new Date();
//    return 'Monday'; //fake the day - for debugging only!
  }
  var weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekday[d.getDay()];
}

function tstamp_mmddyyyy(tstamp) {
  if (tstamp == undefined)
    tstamp = new Date();
  return Utilities.formatDate(tstamp, 'GMT-4', 'MM.dd.yyyy');
}

function delta_days(tstamp_ms0, tstamp_ms1) {
  var one_day_ms = 1000 * 60 * 60 * 24;
  if (tstamp_ms1 == undefined)
    tstamp_ms1 = (new Date()).getTime();
  return Math.round((tstamp_ms1 - tstamp_ms0) / one_day_ms);
}

function get_registry_ss_id() {
    return PropertiesService.getScriptProperties().getProperty('prop_registry_ss_id');
}

function get_static_questions(today) {
  var sheet = SpreadsheetApp.openById(get_registry_ss_id()).getSheetByName('static_questions');
  var rows = sheet.getDataRange().getValues();
  var quest_col = rows[0].indexOf('question'); //get index of column titled 'question'
  var rqd_col = rows[0].indexOf('response_required'); //get index of column titled 'response_required'
  var day_col = rows[0].indexOf('day'); //get index of column titled 'day'
  var todays_quests = [];
  rows.forEach(function(row) {
    if (row[day_col] == today) {
      //normalize 'response_required' entry to a proper boolean...
      if (['true', 'y', 'yes', '1', 'required'].includes(String(row[rqd_col]).toLowerCase()))
        row[rqd_col] = true;
      else
        row[rqd_col] = false;
      todays_quests.push([row[quest_col], row[rqd_col]]);
    }
  });
  return todays_quests;
}

function get_dynamic_questions(today) {
  var form_id = get_id('add_quest_form_id');
  var form = FormApp.openById(form_id);
  var formResponses = form.getResponses();
  var todays_quests = [];
  formResponses.filter(function(formResponse) {
    var tstamp = (new Date(formResponse.getTimestamp())).getTime();
    if (delta_days(tstamp) < 7) {
      var itemResponses = formResponse.getItemResponses();
      var question = itemResponses[0].getResponse();
      var reqd = itemResponses[1].getResponse();
      var day = itemResponses[2].getResponse();
      if (day == today) {
        //normalize 'response_required' entry to proper boolean value...
        if(['true', 'y', 'yes', '1', 'required'].includes(String(reqd).toLowerCase()))
          reqd = true;
        else
          reqd = false;
        todays_quests.push([question, reqd]);
        return [question, reqd];
      }
    }
  });
  return todays_quests;
}

function get_email_addresses() {
  var sheet = SpreadsheetApp.openById(get_registry_ss_id()).getSheetByName('email');
  var rows = sheet.getDataRange().getValues();
  var team_col = rows[0].indexOf('team_email_addresses');
  var email_addresses = rows.map(function(value, index) { return value[team_col]; });
  email_addresses.shift(); //remove header row
  return email_addresses;
}

function form_add_question(form, question, required) {
  form.addParagraphTextItem()
      .setTitle(question)
      .setRequired(required);
}

function clear_form(form) {
  var items = form.getItems();
  while(items.length > 0) {
    form.deleteItem(items.pop());
  }
  form.deleteAllResponses();
}

function invitation_sender(form_url) {
  MailApp.sendEmail({
    to: get_email_addresses().join(', '),
    replyto: PropertiesService.getScriptProperties().getProperty('email_recipients'),
    subject: '[InSync] Invitation to share ' + tstamp_mmddyyyy(),
    htmlBody: 'Provide your <a href=' + form_url + '>update</a> before 4:00 PM ET / 1:00 PM PT.'
  });
}

function prepare_results_email(results) {
  var email_body = 'Click on a user.name to send feedback to an individual.<br>';
  email_body += 'Replying to this message will address the entire team.<br>';
  for (var e = 0; e < results.length; e++) {
    var str_q = '<h3>' + results[e].question + '</h3>';
    var str_ur = '';
    for (var u = 0; u < results[e].user_resp.length; u++) {
      var user_email = results[e].user_resp[u].user_email;
      var user = user_email.split('@', 1);
      var sbj = results[e].question + ' ' + tstamp_mmddyyyy();
      var bdy = encodeURI('\r\n........\r\n' + results[e].user_resp[u].response);
      var str_u = '<a href=\"mailto:' + user_email + '?subject=' + sbj + '&body=\
                  ' + bdy + '\" target=\"_top\">' + user + '</a>';
      var str_r = '<p style=\"margin-left: 40px\">\
                  ' + results[e].user_resp[u].response.replace(/(?:\r\n|\r|\n)/g, '<br>') + '</p>';
      str_ur += str_u + str_r;
    }
    email_body += str_q + str_ur;
  }
  return(email_body);
}

function get_id(id_label) {
  var registry_ids = SpreadsheetApp.openById(get_registry_ss_id())
                                .getSheetByName('ids')
                                .getDataRange()
                                .getValues();
  var id_entry = registry_ids.filter(function(row) {
    if (row[0] == id_label)
      return row;
  });
  return id_entry[0][1]
}

function set_id(id_label, id) {
  var sheet = SpreadsheetApp.openById(get_registry_ss_id()).getSheetByName('ids');
  var registry_ids = sheet.getDataRange().getValues();
  registry_ids.forEach(function(row, index) {
    if (row[0] == id_label)
      SpreadsheetApp.getActiveSheet().getRange(index, 1).setValue(id);
  });
}

function get_form_responses() {
  var form_id = get_id('form_id');
  var form = FormApp.openById(form_id);
  var formResponses = form.getResponses();
  var entries = [];
  for (var i = 0; i < formResponses.length; i++) {
    var formResponse = formResponses[i];
    var itemResponses = formResponse.getItemResponses();
    var quests = [];
    var resps = [];
    for (var j = 0; j < itemResponses.length; j++) {
      var itemResponse = itemResponses[j];
      quests.push(itemResponse.getItem().getTitle());
      resps.push(itemResponse.getResponse());
    }
    entries.push({timestamp: formResponse.getTimestamp(),
                  user_email: formResponse.getRespondentEmail(),
                  questions: quests,
                  responses: resps});
  }
  return entries;
}

function parse_results(entries) {
  // \todo replace nested loops with clever JS voodoo
  // consolidate responses from all users for each question
  // [{question: null, user_resp: [{user: null, response: null}]}]
  var results = [];
  for (var q = 0; q < entries[0].questions.length; q++) {
    var ur = [];
    for (var e = 0; e < entries.length; e++) {
      if (entries[e].responses[q].length > 0)
        ur.push({user_email: entries[e].user_email, response: entries[e].responses[q]});
    }
    results.push({question: entries[0].questions[q], user_resp: ur});
  }
  return results;
}

function record_entries(entries) {
  var ss = SpreadsheetApp.openById(get_registry_ss_id());
  var sheet = ss.getSheetByName('record');
  //write questions
  sheet.appendRow(['-','-'].concat(entries[0].questions));
  //write responses
  entries.forEach(function(entry) {
    sheet.appendRow([entry.timestamp, entry.user_email].concat(entry.responses));
  });
}

function results_sender(email_body) {
  var email_addresses = get_email_addresses().join(', ');
  MailApp.sendEmail({
    to: email_addresses,
    replyto: email_addresses,
    subject: '[InSync] Update ' + tstamp_mmddyyyy(),
    htmlBody: email_body
  });
  Logger.log('Results sent.');
}

function set_trigger(today, trig_day, trig_hour, handler) {
  clear_triggers();
  ScriptApp.newTrigger(handler)
  .timeBased()
  .onWeekDay(trig_day)
  .atHour(trig_hour)
  .inTimezone('US/Eastern')
  .nearMinute(15)
  .everyWeeks(1)
  .create();
}

function clear_triggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++)
    ScriptApp.deleteTrigger(triggers[i]);
}
