const express = require("express");
require("dotenv").config({ path: __dirname + "/.env" });
const router = express.Router();
var mongoose = require("mongoose");
const {
  Projectmodel,
  Subscriberprojectmodel,
  Subscriberworkflow,
} = require("../models/project");

const auth = require("../middleware/Auth");

router.post("/projectlist", auth, async (req, res) => {
  Projectmodel.find({}, (err, result) => {
    if (err) {
      res.status(200).json({
        status: "400",
        message: "Something Went Wrong",
      });
    }

    if (result.length > 0) {
      res.status(200).json({
        status: "200",
        message: "Data Found",
        result: result,
      });
    } else {
      res.status(200).json({
        status: "200",
        message: "No Data Found",
        result: result,
      });
    }
  });
});

router.post("/subscriberprojectlist", auth, async (req, res) => {
  let subscriberprojectdata = {
    // subscriber_id: mongoose.Types.ObjectId(req.body.subscriber_id),
    company_id: mongoose.Types.ObjectId(req.body.company_id),
  };

  Subscriberprojectmodel.aggregate(
    [
      { $match: subscriberprojectdata },
      {
        $lookup: {
          localField: "company_id",
          from: "companyaccounts",
          foreignField: "_id",
          as: "company_idinfo",
        },
      },
      {
        $lookup: {
          localField: "project_id",
          from: "projects",
          foreignField: "_id",
          as: "project_idinfo",
        },
      },
    ],
    (err, result) => {
      if (err) {
        res.status(500).json({
          status: "500",
          message: "Something Went Wrong",
        });
      }

      if (result) {
        res.status(200).json({
          status: "200",
          message: "Data Found",
          result: result,
        });
      } else {
        res.status(200).json({
          status: "200",
          message: "No Data Found",
          result: result,
        });
      }
    }
  );

  //     Subscriberprojectmodel.find(subscriberprojectdata, (err,result) => {

  // if(err)
  // {
  // res.status(200).json({
  //     status:"400",
  //     message:"Something Went Wrong"
  // })
  // }

  // if(result.length>0)
  // {
  // res.status(200).json({
  //     status:"200",
  //     message:"Data Found",
  //     result:result
  // })
  // }
  // else{
  // res.status(200).json({
  //     status:"200",
  //     message:"No Data Found",
  //     result:result
  // })
  // }

  // })
});

router.post("/subscriberworkflowlist", auth, async (req, res) => {
  let subscriberprojectdata = {
    // subscriber_id: mongoose.Types.ObjectId(req.body.subscriber_id),
    company_id: mongoose.Types.ObjectId(req.body.company_id),
    subscriberproject_id: mongoose.Types.ObjectId(
      req.body.subscriberproject_id
    ),
    // "user_idinfo.active": {$ne:"1"},
    // "user_idinfo.roles": {$ne:"Employee"},
  };

  Subscriberworkflow.aggregate(
    [
      { $match: subscriberprojectdata },
      {
        $lookup: {
          localField: "company_id",
          from: "companyaccounts",
          foreignField: "_id",
          as: "company_idinfo",
        },
      },
      {
        $lookup: {
          localField: "subscriberproject_id",
          from: "subscriberprojects",
          foreignField: "_id",
          as: "subscriberproject_idinfo",
        },
      },
      {
        $lookup: {
          localField: "company_id",
          from: "users",

          foreignField: "companyid",

          as: "user_idinfo",
        },
      },
      {
        $lookup: {
          localField: "subscriberproject_idinfo.project_id",
          from: "projects",
          foreignField: "_id",
          as: "project_idinfo",
        },
      },
      { $sort: { sequence: 1 } },
    ],
    (err, result) => {
      if (err) {
        res.status(500).json({
          status: "500",
          message: "Something Went Wrong",
        });
      }

      if (result) {
        res.status(200).json({
          status: "200",
          message: "Data Found",
          result: result,
        });
      } else {
        res.status(200).json({
          status: "200",
          message: "No Data Found",
          result: result,
        });
      }
    }
  );

  //     Subscriberprojectmodel.find(subscriberprojectdata, (err,result) => {

  // if(err)
  // {
  // res.status(200).json({
  //     status:"400",
  //     message:"Something Went Wrong"
  // })
  // }

  // if(result.length>0)
  // {
  // res.status(200).json({
  //     status:"200",
  //     message:"Data Found",
  //     result:result
  // })
  // }
  // else{
  // res.status(200).json({
  //     status:"200",
  //     message:"No Data Found",
  //     result:result
  // })
  // }

  // })
});

router.post("/addproject", async (req, res) => {
  let subscriber_id = req.body.subscriber_id;
  let project_id = req.body.project_id;
  let company_id = req.body.company_id;
  let subscriberprojectdata = {
    // subscriber_id: subscriber_id,
    project_id: project_id,
    company_id: company_id,
  };

  Subscriberprojectmodel.find(subscriberprojectdata, async (err, result) => {
    console.log("result" + result);
    if (!result) {
      res.status(200).json({ status: "400", message: "Already  Saved" });
    }

    if (result) {
      let subscriberprojectdata1 = Subscriberprojectmodel(
        subscriberprojectdata
      );
      let subscriberprojectresponse = await subscriberprojectdata1.save();

      if (subscriberprojectresponse) {
        res
          .status(200)
          .json({
            status: "200",
            message: "Successfully Saved",
            result: subscriberprojectresponse,
          });
      } else {
        res
          .status(200)
          .json({ status: "400", message: "Successfully Saved Failed" });
      }
    }
  });
});

router.post("/addsubscriberworkflow", async (req, res) => {
  let subscriber_id = req.body.subscriber_id;
  let subscriberproject_id = req.body.subscriberproject_id;
  let company_id = req.body.company_id;
  let message = req.body.message;
  let name = req.body.name;

  let subscriberprojectdata = {
    // subscriber_id: subscriber_id,
    subscriberproject_id: subscriberproject_id,
    company_id: company_id,
    message: message,
    name: name,
  };

  Subscriberworkflow.find(subscriberprojectdata, async (err, result) => {
    console.log("result" + result);
    if (!result) {
      res.status(200).json({ status: "400", message: "Already  Saved" });
    }

    if (result) {
      let subscriberprojectdata1 = Subscriberworkflow(subscriberprojectdata);
      let subscriberprojectresponse = await subscriberprojectdata1.save();

      if (subscriberprojectresponse) {
        res.status(200).json({ status: "200", message: "Successfully Saved" });
      } else {
        res
          .status(200)
          .json({ status: "400", message: "Successfully Saved Failed" });
      }
    }
  });
});

router.post("/addsubscriberworkflowmultiple", async (req, res) => {
  // let subscriber_id = req.body.subscriber_id;
  // let subscriberproject_id = req.body.subscriberproject_id;
  // let company_id = req.body.company_id;
  // let message = req.body.message;
  // let name = req.body.name;

  let subscriberprojectdata = req.body.workflow;
  console.log("workflow" + subscriberprojectdata);
  // Subscriberworkflow.find(subscriberprojectdata,async (err,result)=>{
  //        console.log("result"+result)
  //     if(result!='')
  //     {
  //         res.status(200).json({ status: "400", message: "Already  Saved" });
  //     }

  //     if(result=='')
  //     {
  let subscriberprojectresponse = "";
  for (let i = 0; i < subscriberprojectdata.length; i++) {
    let subscriberprojectdata111111 = {
      subscriber_id: subscriberprojectdata[i].subscriber_id,
      subscriberproject_id: subscriberprojectdata[i].subscriberproject_id,
      company_id: subscriberprojectdata[i].company_id,
      message: subscriberprojectdata[i].message,
      name: subscriberprojectdata[i].name,
      sequence: subscriberprojectdata[i].sequence,
    };

    let subscriberprojectdata1 = Subscriberworkflow(
      subscriberprojectdata111111
    );
    subscriberprojectresponse = await subscriberprojectdata1.save();
  }

  if (subscriberprojectresponse) {
    res.status(200).json({ status: "200", message: "Successfully Saved" });
  } else {
    res
      .status(200)
      .json({ status: "400", message: "Successfully Saved Failed" });
  }
  // }
});

// });

router.post("/workflowdone", async (req, res) => {
  let subscriberworkflows_id = req.body.id;

  let subscriberworkflowsdata = {
    _id: subscriberworkflows_id,
  };

  Subscriberworkflow.find(subscriberworkflowsdata, async (err, result) => {
    console.log("result" + result);
    if (result != "") {
      Subscriberworkflow.updateOne(
        { _id: subscriberworkflows_id },
        {
          $set: {
            status: "1",
          },
        },
        (err, result) => {
          if (err) {
            res.status(200).json({
              status: "400",
              msg: "Updation failed",
            });
          } else {
            return res.status(200).json({
              status: "200",
              msg: "Task is Sucessfully Completed",
            });
          }
        }
      );
    }

    if (result == "") {
      res.status(200).json({ status: "400", message: "Invalid Workflow" });
    }
  });
});

module.exports = router;
