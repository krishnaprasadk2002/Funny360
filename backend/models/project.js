const joi = require("joi");
const mongoose = require("mongoose");
const Schema=mongoose.Schema;

var projectschema = mongoose.Schema({
  name: { type: String, require: true },
});

var projectmodel = mongoose.model("Project", projectschema);

exports.Projectmodel = projectmodel;



var subscriberprojectschema = mongoose.Schema({
    subscriber_id: { type: mongoose.Schema.Types.ObjectId, require: true,ref:"User" },
    project_id: { type: mongoose.Schema.Types.ObjectId,  require: true ,ref:"Projectmodel"},
    company_id: { type: mongoose.Schema.Types.ObjectId,  require: true ,ref:"Companyaccount"},
  });
  
  var subscriberprojectmodel = mongoose.model("subscriberproject", subscriberprojectschema);
  
  exports.Subscriberprojectmodel = subscriberprojectmodel;
  

  var subscriberworkflowschema=mongoose.Schema({
    subscriber_id:{
        type:Schema.Types.ObjectId,
        require:true,
        ref:"User"
    },
    company_id:{
        type:Schema.Types.ObjectId,
        require:true,
        ref:"Companyaccount"
    },
    subscriberproject_id:{
        type:Schema.Types.ObjectId,
        require:true,
        ref:"subscriberproject"
    },
    message:
    {
        type:String,
        require:true
    }
    ,
    name:
    {
        type:String,
        require:true
    }
    ,
    status:
    {
        type:String,
        require:true,
        default:'0',
    }
    ,
    sequence:
    {
        type:Intl,
        require:true,
    }
},{timestamps:true})


const subscriberworkflowmodel=mongoose.model("subscriberWorkflow",subscriberworkflowschema)

exports.Subscriberworkflow=subscriberworkflowmodel
