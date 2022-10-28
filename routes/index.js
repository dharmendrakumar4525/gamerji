const express = require('express')
const router = express.Router()
const formidable = require('formidable')
const AWS = require('aws-sdk')
const fs = require('fs')
const textractHelper = require('aws-textract-helper')
const { Parser } = require("json2csv");
const { Console } = require('console')

require('dotenv').config()

/* GET home page. */
router.get('/', (req, res, next) => {
  // downloadCsv(req,res);
  res.render('index', { title: 'This tool is explicitly designed for Gamerji, to extract Leader Board tables from FreeFire Contest Result' })
})

router.get("/csv-download", (req, res, next) => {
      res.render("index", { title: "Textract Uploader" });
});

router.post('/fileupload', (req, res, next) => {
  // Upload logic
  const form = new formidable.IncomingForm()
  console.log(form,"Asdfasdfasdfasdf");
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err)
    }
    const fileContent = fs.readFileSync(files.filetoupload.path)
    const s3Params = {
      Bucket: process.env.AWS_BUCKET,
      Key: `${Date.now().toString()}-${files.filetoupload.name}`,
      Body: fileContent,
      ContentType: files.filetoupload.type,
      ACL: 'public-read'
    }
    const s3Content = await s3Upload(s3Params)
    const textractData = await documentExtract(s3Content.Key);
    const formData = textractHelper.createTables(textractData);
    console.log(formData);
    await downloadCsv(formData,res);
    res.render('fileupload', { title: 'Upload Results', formData })
  })
})

async function s3Upload (params) {
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
  })
  return new Promise(resolve => {
    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err)
        resolve(err)
      } else {
        resolve(data)
      }
    })
  })
}

async function documentExtract (key) {
  return new Promise(resolve => {
    var textract = new AWS.Textract({
      region: process.env.AWS_REGION,
      endpoint: `https://textract.${process.env.AWS_REGION}.amazonaws.com/`,
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY
    })
    var params = {
      Document: {
        S3Object: {
          Bucket: process.env.AWS_BUCKET,
          Name: key,
        },
      },
      FeatureTypes: ["TABLES"],
    };

    textract.analyzeDocument(params, (err, data) => {
      if (err) {
        return resolve(err)
      } else {
        resolve(data)
      }
    })
  })
}


async function dataModify(data) {
  let array =[];
  let rank=0;
  if(  Object.keys(data[0][1]).length==5){
   for (const property in data[0]) {
        var object = {};
         object.rank = rank++;
         object.usersname = data[0][property][1];
         object.eliminations = data[0][property][2];
         object.rank1 = data[0][property][3];
         object.usersname1 = data[0][property][4];
         object.eliminations1 = data[0][property][5];
         array.push(object);
   }
   return array;
  }
  else{
     for (const property in data[0]) {
       var object = {};
       object.rank = rank++;
       object.usersname = data[0][property][2];
       object.eliminations = data[0][property][3];
       object.rank1 = data[0][property][4];
       object.usersname1 = data[0][property][5];
       object.eliminations1 = data[0][property][6];
       array.push(object);
     }
     return array;
  }

  }

async function downloadCsv(data,res) {
  const fields = [
    {
      label: "Rank",
      value: "rank",
    },
    {
      label: "User Name",
      value: "usersname",
    },
    {
      label: "Eliminations",
      value: "eliminations",
    },
    {
      label: "Rank",
      value: "rank1",
    },
    {
      label: "User Name",
      value: "usersname1",
    },
    {
      label: "Eliminations",
      value: "eliminations1",
    },
  ];
  data=await dataModify(data);
  return downloadResource(res, "users.csv", fields, data);

}


async function downloadResource(res, fileName, fields, data) {
  const json2csv = new Parser({ fields });
  const csv = json2csv.parse(data);
  res.header("Content-Type", "text/csv");
  res.attachment(fileName);
  return res.send(csv);
}

module.exports = router
