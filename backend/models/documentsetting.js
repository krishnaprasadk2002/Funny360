const joi=require("joi");
const mongoose=require("mongoose");
const Schema=mongoose.Schema;

var documentsetting=mongoose.Schema({
name:{
    type:String,
    require:true
},
userid:{
    type:Schema.Types.ObjectId,
    require:true,
    ref:"User"
},
content:
{
    type:String,
    require:true
},


},{timestamp:true})


const Documentsetting=mongoose.model('documentsetting',documentsetting);


exports.documentsetting=Documentsetting;