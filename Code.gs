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
    var results = structure_results(entries);
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
  static_questions.forEach(q => form_add_question(form, q[0], q[1]));
  //pull one-off questions from the "add question" form
  var dynamic_questions = get_dynamic_questions(day);
  dynamic_questions.forEach(q => form_add_question(form, q[0], q[1]));
  return form;
}

function form_initializer(form_id) {
  var form;
  try {
    form = FormApp.openById(form_id);
    clear_form(form);
  } catch(err) {
    Logger.log(err);
    Logger.log('creating new form');
    form = FormApp.create('insync_update');
    //update form_id in registry
    set_id('form_id', form.getId());
  } finally {

    var description = 'Say bye bye bye to meetings.';
    if (typeof nmd === 'function')
      description += '\n\nUse Markdown to format your responses: *italics*, **bold**, - list, [link](url).';
    form.setTitle('Insync')
        .setDescription(description)
        .setRequireLogin(true)
        .setCollectEmail(true)
        .setAllowResponseEdits(true);
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
  rows.forEach(row => {
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
  var form_responses = form.getResponses();
  var todays_quests = [];
  form_responses.forEach(form_response => {
    var tstamp = (new Date(form_response.getTimestamp())).getTime();
    if (delta_days(tstamp) < 7) {
      var item_responses = form_response.getItemResponses();
      var question = item_responses[0].getResponse();
      var reqd = item_responses[1].getResponse();
      var day = item_responses[2].getResponse();
      if (day == today) {
        //normalize 'response_required' entry to proper boolean value...
        if(['true', 'y', 'yes', '1', 'required'].includes(String(reqd).toLowerCase()))
          reqd = true;
        else
          reqd = false;
        todays_quests.push([question, reqd]);
      }
    }
  });
  return todays_quests;
}

function get_email_addresses() {
  var sheet = SpreadsheetApp.openById(get_registry_ss_id()).getSheetByName('email');
  var rows = sheet.getDataRange().getValues();
  var team_col = rows[0].indexOf('team_email_addresses');
  var email_addresses = rows.map(value => value[team_col]);
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
  if (typeof nmd === 'function')
    Logger.log('nmd parser defined');
  else {
    Logger.log('nmd parser undefined');
    nmd = (txt) => {return txt};
  }
  results.forEach(result => {
    var str_q = '<h3>' + result.question + '</h3>';
    var str_ur = '';
    result.user_resp.forEach(user_resp => {
      var user_email = user_resp.user_email;
      var user = user_email.split('@', 1);
      var sbj = result.question + ' ' + tstamp_mmddyyyy();
      var bdy = encodeURI('\r\n---\r\n' + user_resp.response);
      var str_u = '<a href=\"mailto:' + user_email + '?subject=' + sbj + '&body=\
                  ' + bdy + '\" target=\"_top\">' + user + '</a>';
      user_resp.response = nmd(user_resp.response).replace(/(?:\r\n|\r|\n)/g, '<br>');
      var str_r = user_resp.response.replace('<p>', '<p style=\"margin-left: 20px\">');
      str_ur += str_u + str_r;
    });
    email_body += str_q + str_ur;
  });
  return email_body;
}

function get_id(id_label) {
  var registry_ids = SpreadsheetApp.openById(get_registry_ss_id())
                                   .getSheetByName('ids')
                                   .getDataRange()
                                   .getValues();
  var id_entry = registry_ids.filter(row => row[0] == id_label)[0];
  return id_entry[1];
}

function set_id(id_label, id) {
  var sheet = SpreadsheetApp.openById(get_registry_ss_id()).getSheetByName('ids');
  var registry_ids = sheet.getDataRange().getValues();
  registry_ids.filter(row => row[0] == id_label)
              .forEach((row, index) => SpreadsheetApp.getActiveSheet().getRange(index, 1).setValue(id));
}

function get_form_responses() {
  var form_responses = FormApp.openById(get_id('form_id')).getResponses();
  var entries = [];
  form_responses.forEach(form_response => {
    let item_responses = form_response.getItemResponses();
    let quests = [];
    let resps = [];
    item_responses.forEach(item_response => {
      quests.push(item_response.getItem().getTitle());
      resps.push(item_response.getResponse());
    });
    entries.push({timestamp: form_response.getTimestamp(),
                  user_email: form_response.getRespondentEmail(),
                  questions: quests,
                  responses: resps});
  });
  return entries;
}

function structure_results(entries) {
  // consolidate responses from all users for each question
  // [{question: null, user_resp: [{user: null, response: null}]}]
  var results = [];
  entries[0].questions.forEach((question, q_index) => {
    let ur = [];
    // filter out empty responses
    entries.filter(entry => entry.responses[q_index].length > 0)
           .forEach(entry => ur.push({user_email: entry.user_email,
                                      response: entry.responses[q_index]}));
    results.push({question: question, user_resp: ur});
  });
  return results;
}

function record_entries(entries) {
  var sheet = SpreadsheetApp.openById(get_registry_ss_id()).getSheetByName('record');
  //write questions
  sheet.appendRow(['-','-'].concat(entries[0].questions));
  //write responses
  entries.forEach(entry => sheet.appendRow([entry.timestamp, entry.user_email].concat(entry.responses)));
}

function results_sender(email_body) {
  var email_addresses = get_email_addresses().join(', ');
  MailApp.sendEmail({
    to: email_addresses,
    replyto: email_addresses,
    subject: '[InSync] Update ' + tstamp_mmddyyyy(),
    htmlBody: email_body
  });
  Logger.log('results sent.');
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

function bootstrap() {
  //create a new registry and set script property to point to it
  var registry_ss = SpreadsheetApp.create('insync_registry');
  script_properties = PropertiesService.getScriptProperties();
  script_properties.setProperty('prop_registry_ss_id', registry_ss.getId());

  registry_ss.getSheets()[0].setName('record');

  registry_ss.insertSheet('static_questions')
             .appendRow(['question', 'response_required', 'day'])
             .appendRow(['Priorities for this week:', 'yes', 'Monday'])
             .appendRow(['Other thoughts:', 'no', 'Monday'])
             .appendRow(['Highlights from this week:', 'yes', 'Friday'])
             .appendRow(['Other thoughts:', 'no', 'Friday'])
             .setFrozenRows(1);

  registry_ss.insertSheet('email')
             .appendRow(['team_email_addresses', 'limited_email_addresses'])
             .setFrozenRows(1);

  registry_ss.insertSheet('ids')
             .appendRow(['label', 'id'])
             .appendRow(['form_id'])
             .appendRow(['add_quest_form_id'])
             .setFrozenRows(1);
}

function nmd(md) {
  /**
   * Based on nano-markdown - a minimal markdown to html converter
   * Copyright (c) 2015, Vladimir Antonov. (MIT Licensed)
   * https://github.com/Holixus/nano-markdown
   */
  var escapes = '\\[!]#{()}*+-._';
  var esc_ofs = 16;

  var unesc = (a) => {
    return a.replace(/\x01([\x0f-\x1c])/g, (m, c) => {
      return escapes.charAt(c.charCodeAt(0) - esc_ofs);
    });
  }

  var lex = (a) => {
    return a.replace(/\\([(){}[\]#*+\-.!_\\])/g, (m, ch) => {
      return String.fromCharCode(1, escapes.indexOf(ch) + esc_ofs);
    }).replace(/(\*\*|__|~~)(\S(?:[\s\S]*?\S)?)\1/g, (m, delim, text) => {
      return (delim === '~~') ? '<del>' + text + '</del>' : '<b>' + text + '</b>';
    }).replace(/(\n|^|\W)([_\*])(\S(?:[\s\S]*?\S)?)\2(\W|$|\n)/g, (m, l, di, ital, r) => {
      return l + '<i>' + ital + '</i>' + r;
    }).replace(/(!?)\[([^\]<>]+)\]\((\+?)([^ \)<>]+)(?: "([^\(\)\"]+)")?\)/g, (match, is_img, text, new_tab, ref, title) => {
      var attrs = title ? ' title="' + title + '"' : '';
      if (is_img)
        return '<img src="' + nmd_href(ref) + '" alt="' + text + '"' + attrs + '/>';
      if (new_tab)
        attrs += ' target="_blank"';
      return '<a href="' + nmd_href(ref) + '"' + attrs + '>' + text + '</a>';
    });
  }

  var nmd_href = (ref) => {
    return ref;
  }

  var nmd_headAttrs = (level, text) => {
    return ''; // return ' id=\''+text.replace(/[^a-z0-9]/g, '_').replace(/_{2,}/g, '_').replace(/^_*(.*?)_*$/, '$1').toLowerCase()+'\'';
  }

  return md.replace(/.+(?:\n.+)*/g, (m) => {
    var code = /^\s{4}([^]*)$/.exec(m);
    if (code)
      return '<pre><code>' + code[1].replace(/\n    /g, '\n') + '</code></pre>';
    var ps = [];
    var cur;
    var rows = lex(m).split('\n');
    var l = rows.length;
    rows.forEach((row, i) => {
      var head = /^\s{0,3}(\#{1,6})\s+(.*?)\s*#*\s*$/.exec(row);
      if (head) { // heading
        ps.push(cur = [ head[2], 'h', head[1].length ]); // cur = [ text, type, level ]
        return;
      }
      var list = /^(\s*)(?:[-*]|(\d[.)])) (.+)$/.exec(row);
      if (list)
        ps.push(cur = [ list[3], list[2] ? 'ol' : 'ul', list[1].length ]); // cur = [ text, type, level ]
      else
        if (/^\s{0,3}([-])(\s*\1){2,}\s*$/.test(row))
          ps.push(cur = [ '', 'hr' ]);
        else
          if (cur && cur[1] !== 'hr' && cur[1] !== 'h')
            cur[0] += '\n' + row;
          else
            ps.push(cur = [ row, 'p', '' ]);
    });
    var out = '', lists = [];
    ps.forEach((cur, i) => {
      var text = cur[0];
      var tag = cur[1];
      var lvl = cur[2];
      if (tag === 'ul' || tag === 'ol') {
        if (!lists.length || lvl > lists[0][1]) {
          lists.unshift([ tag, lvl ]);
          out += '<' + lists[0][0] + '><li>' + text;
        } else
          if (lists.length > 1 && lvl <= lists[1][1]) {
            out += '</li></' + lists.shift()[0] + '>';
            --i;
          } else
            out += '</li><li>' + text;
      } else {
        while (lists.length)
          out += '</li></' + lists.shift()[0] + '>';
        out += (tag === 'hr') ? '<hr/>' : '<' + tag + lvl + nmd_headAttrs(lvl, text) + '>' + text + '</' + tag + lvl + '>';
      }
    });
    while (lists.length)
      out += '</li></' + lists.shift()[0] + '>';
    return unesc(out);
  });
}
