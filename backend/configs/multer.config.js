const multiparty = require("multiparty");
const multer = require("multer");
const fs = require("fs");
const liveurlnew = "./uploads";
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "address_proof") {
        cb(null, liveurlnew + "/address_proof");
      }
      if (file.fieldname === "identity_card") {
        cb(null, liveurlnew + "/identity_card");
      }
      if (file.fieldname === "esign") {
        cb(null, liveurlnew + "/esign");
      }
      if (file.fieldname === "gsign") {
        cb(null, liveurlnew + "/gsign");
      }
    },
    filename: (req, file, cb) => {
      if (file != "") {
        cb(
          null,
          file.fieldname + "-" + Date.now() + path.extname(file.originalname)
        );
      }
    },
  });
  const upload = multer({ storage: storage });

  module.exports = {upload,liveurlnew}