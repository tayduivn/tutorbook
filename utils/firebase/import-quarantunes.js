const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'test';
console.log(`Loading ${env} environment variables...`);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) });
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}.local`) });

console.log(
  'Using Firebase configuration:',
  JSON.stringify(
    {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      serviceAccountId: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    },
    null,
    2
  )
);

const { v4: uuid } = require('uuid');
const { default: to } = require('await-to-js');
const parse = require('csv-parse/lib/sync');
const progress = require('cli-progress');
const mime = require('mime-types');
const axios = require('axios');
const phone = require('phone');
const admin = require('firebase-admin');
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_ADMIN_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  }),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  serviceAccountId: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
});
const auth = app.auth();
const db = app.firestore();
const bucket = app.storage().bucket();

const firebase = require('firebase/app');
require('firebase/auth');

const clientCredentials = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
if (!firebase.apps.length) firebase.initializeApp(clientCredentials);

const updateSubjects = require('./update-subjects');

/**
 * CSVToArray parses any String of Data including '\r' '\n' characters,
 * and returns an array with the rows of data.
 * @param {String} CSV_string - the CSV string you need to parse
 * @param {String} delimiter - the delimeter used to separate fields of data
 * @returns {Array} rows - rows of CSV where first row are column headers
 */
function CSVToArray(CSV_string, delimiter) {
  delimiter = delimiter || ','; // user-supplied delimeter or default comma

  var pattern = new RegExp( // regular expression to parse the CSV values. // Delimiters:
    '(\\' +
      delimiter +
      '|\\r?\\n|\\r|^)' +
      // Quoted fields.
      '(?:"([^"]*(?:""[^"]*)*)"|' +
      // Standard fields.
      '([^"\\' +
      delimiter +
      '\\r\\n]*))',
    'gi'
  );

  var rows = [[]]; // array to hold our data. First row is column headers.
  // array to hold our individual pattern matching groups:
  var matches = false; // false if we don't find any matches
  // Loop until we no longer find a regular expression match
  while ((matches = pattern.exec(CSV_string))) {
    var matched_delimiter = matches[1]; // Get the matched delimiter
    // Check if the delimiter has a length (and is not the start of string)
    // and if it matches field delimiter. If not, it is a row delimiter.
    if (matched_delimiter.length && matched_delimiter !== delimiter) {
      // Since this is a new row of data, add an empty row to the array.
      rows.push([]);
    }
    var matched_value;
    // Once we have eliminated the delimiter, check to see
    // what kind of value was captured (quoted or unquoted):
    if (matches[2]) {
      // found quoted value. unescape any double quotes.
      matched_value = matches[2].replace(new RegExp('""', 'g'), '"');
    } else {
      // found a non-quoted value
      matched_value = matches[3];
    }
    // Now that we have our value string, let's add
    // it to the data array.
    rows[rows.length - 1].push(matched_value);
  }
  return rows; // Return the parsed data Array
}

// TODO: Figure out a way to request the original quality from Wix instead of
// a 500x500 version of the photo. This will also impose some bad cropping.
function getPhotoURL(photo, width = 500, height = 500) {
  const id = photo.split('/').pop();
  const size = `w_${width},h_${height}`;
  return `https://static.wixstatic.com/media/${id}/v1/fill/${size}/${id}`;
}

async function downloadFile(url, filename = uuid()) {
  if (url === 'https://tutorbook.app/app/img/male.png') return './male.png';
  if (url === 'https://tutorbook.app/app/img/female.png') return './female.png';
  if (url === 'https://tutorbook.app/app/img/loading.gif') return './male.png';
  const [err, res] = await to(axios.get(url, { responseType: 'stream' }));
  if (err) {
    console.error(`${err.name} fetching (${url}): ${err.message}`);
    return './male.png';
  }
  const extension = mime.extension(res.headers['content-type']);
  const path = `./temp/${filename}.${extension}`;
  const stream = res.data.pipe(fs.createWriteStream(path));
  return new Promise((resolve) => stream.on('finish', () => resolve(path)));
}

function uploadFile(
  filename,
  destination = `temp/${uuid()}.${filename.split('.').pop()}`
) {
  const uid = uuid();
  return bucket
    .upload(filename, {
      destination,
      uploadType: 'media',
      metadata: {
        contentType: mime.contentType(filename.split('/').pop()),
        metadata: { firebaseStorageDownloadTokens: uid },
      },
    })
    .then((data) => {
      const file = data[0];
      const url =
        `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
        `${encodeURIComponent(file.name)}?alt=media&token=${uid}`;
      return Promise.resolve(url);
    });
}

function period(str) {
  if (!str || str.endsWith('.') || str.endsWith('!')) return str;
  return `${str}.`;
}

function getSubjects(id) {
  return parse(fs.readFileSync(`../algolia/${id}.csv`), {
    columns: true,
    skip_empty_lines: true,
  }).filter((subject) => !!subject.name);
}

function getUsers() {
  console.log(`Fetching user CSV rows...`);
  const rows = CSVToArray(fs.readFileSync('./quarantunes.csv'));
  console.log(`Fetching mentoring subjects...`);
  const subjects = getSubjects('mentoring');
  rows.shift();
  console.log(`Converting ${rows.length} users...`);
  return rows.map((row) => {
    const [
      _,
      first,
      last,
      email,
      phoneNumber,
      resume,
      instruments,
      experience,
      source,
      city,
      bio,
      photo,
      availability,
      classes,
      start,
      id,
      owner,
      created,
      updated,
    ] = row;
    return {
      id: '',
      name: `${first} ${last}`,
      email: email || '',
      phone: phone(phoneNumber)[0] || '',
      photo: photo ? getPhotoURL(photo) : '',
      bio:
        (bio ? period(bio) : '') +
        (experience ? ` ${period(experience)}` : '') +
        (city ? ` Currently living in ${period(city)}` : '') +
        (availability ? ` Available ${period(availability)}` : ''),
      socials: !resume
        ? []
        : [
            {
              type: 'website',
              url: resume,
            },
          ],
      orgs: ['quarantunes'],
      zooms: [],
      availability: [],
      mentoring: {
        subjects: updateSubjects(
          [...(instruments || '').split(', '), ...(classes || '').split(', ')],
          subjects
        ),
        searches: [],
      },
      tutoring: { subjects: [], searches: [] },
      langs: ['en'],
      parents: [],
      verifications: [],
      visible: true,
      featured: [],
    };
  });
}

async function createUser(user) {
  const photo = user.photo
    ? await uploadFile(await downloadFile(user.photo))
    : '';
  const endpoint = 'https://develop.tutorbook.app/api/users';
  const [err] = await to(axios.post(endpoint, { ...user, photo }));
  if (err) {
    console.log(
      `\n\n${err.name} creating user (${user.name} <${user.email}>): ${
        (err.response || {}).data || err.message
      }\n`
    );
    debugger;
  }
}

async function importQuarantunes() {
  const users = getUsers();
  console.log(`Creating ${users.length} users...`);
  const bar = new progress.SingleBar({}, progress.Presets.shades_classic);
  bar.start(users.length, 0);
  let count = 0;
  await Promise.all(
    users.map(async (user) => {
      await createUser(user);
      count++;
      bar.update(count);
    })
  );
}

async function verifyImport() {
  const users = getUsers();
  console.log(`Verifying ${users.length} users exist...`);
  const bar = new progress.SingleBar({}, progress.Presets.shades_classic);
  bar.start(users.length, 0);
  let count = 0;
  await Promise.all(
    users.map(async (user) => {
      const create = async (data) => {
        console.log(`Creating user (${data.name} <${data.email}>)...`);
        await createUser(data);
        console.log(`Created user (${data.name} <${data.email}>).`);
      };
      const { docs } = await db
        .collection('users')
        .where('email', '==', (user.email || '').toLowerCase())
        .get();
      if (!user.email) {
        console.error(`\nUser (${user.name}) missing email.`);
        debugger;
      } else if (docs.length !== 1) {
        console.error(`\n${docs.length} docs with email (${user.email}).`);
        debugger;
      } else if (!(docs[0].data().orgs || []).includes('quarantunes')) {
        console.error(`\nUser (${user.name} <${user.email}>) missing org.`);
        debugger;
      }
      count++;
      bar.update(count);
    })
  );
}

verifyImport();
