/**
 * Copyright 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * Authors:
 *    - Olaf Hahn
 **/


module.exports = function(RED) {
    "use strict";
    
    var settings = RED.settings;
    var events = require("events");
    var exec = require('child_process').exec;
    var isUtf8 = require('is-utf8');
    var bufMaxSize = 32768;  // Max serial buffer size, for inputs...


    // CameraPI Take Photo Node
    function CameraPiTakePhotoNode(config) {
    	// Create this node
        RED.nodes.createNode(this,config);
        
        // set parameters and save locally 
        this.filemode = config.filemode;
		this.filename =  config.filename;
		this.filedefpath = config.filedefpath;
		this.filepath = config.filepath;
		this.fileformat = config.fileformat;
		this.resolution =  config.resolution;
		this.fliph = config.fliph;
		this.flipv = config.flipv;
		this.name =  config.name;
		this.cameraProc = config.cameraProc;
		this.activeProcesses = {};

		var node = this;
		
        // if there is an new input
		node.on('input', function(msg) {
		
         	var fsextra = require("fs-extra");
         	var fs = require("fs");
         	var uuid = require('node-uuid').v4();
         	var localdir = __dirname;
         	var defdir = '/home/pi/images';
            var cl = "python " + localdir + "/lib/python/get_photo.py";
            var resolution;
            var fileformat;
            var filename;
            var filepath;
            var filemode;
            var filefqn;
            var fliph, flipv;
	    var cameraProc;

         	node.status({fill:"green",shape:"dot",text:"connected"});

		// Check the given camera type
		if (msg.cameraProc) {
			cameraProc = msg.cameraProc;
		} else {
			cameraProc = " raspistill";
		}

         	// Check the given filemode
         	if((msg.filemode) && (msg.filemode !== "")) {
         		filemode = msg.filemode;
         	} else {
         		if (node.filemode) {
         			filemode = node.filemode;
         		} else {
         			filemode = "1";
         		}
         	}
         		
         	if (filemode == "0") {
         		filename = "pic_" + uuid + '.jpg';
         		fileformat = "jepg";
         		filepath = defdir + "/";
         		filefqn = filepath + filename;
                if (RED.settings.verbose) { node.log("camerapi takephoto:"+filefqn); }
         		console.log("CameraPi (log): Tempfile - " + filefqn);

                cl += " " + filename + " " + filepath + " " + fileformat;
         	} else {
	             if ((msg.filename) && (msg.filename.trim() !== "")) {
	         			filename = msg.filename;
	        	} else {
	        		if (node.filename) {
	             		filename = node.filename;
	        		} else {
	             		filename = "pic_" + uuid + '.jpg';
	        		}
	        	}
	 			cl += " "+filename;
	
	         	if ((msg.filepath) && (msg.filepath.trim() !== "")) {
	     			filepath = msg.filepath;
	         	} else {
	         		if (node.filepath) {
	         			filepath = node.filepath;
	         		} else {
	         			filepath = defdir + "/images/";
	         		}
	         	}
	 			cl += " "+filepath;
	     		
	         	if ((msg.fileformat) && (msg.fileformat.trim() !== "")) {
	     			fileformat = msg.fileformat;
	         	} else {
	         		if (node.fileformat) {
	         			fileformat = node.fileformat;
	         		} else {
	         			fileformat = "jpeg";
	         		}
	         	}
	 			cl += " "+fileformat;         		
         	}
         	
         	if ((msg.resolution) && (msg.resolution !== "")) {
         		resolution = msg.resolution; 
         		} else {
         			if (node.resolution) {
                 		resolution = node.resolution;	        			
         			} else {
                 		resolution = "1";	        			         					
         			}
            	}
         	if (resolution == "1") {
             	cl += " 320 240"; 
         	} else if (resolution == "2" ) {
             	cl += " 640 480";          		
         	} else if (resolution == "3" ) {
             	cl += " 800 600";          		
         	} else  {
             	cl += " 1024 768";          		
         	}

         	if ((msg.fliph) && (msg.fliph !== "")) {
         		fliph = msg.fliph; 
         		} else {
         			if (node.fliph) {
                 		fliph = node.fliph;	        			
         			} else {
                 		fliph = "1";	        			         					
         			}
            	}
         	if ((msg.flipv) && (msg.flipv !== "")) {
         		flipv = msg.flipv; 
         		} else {
         			if (node.flipv) {
                 		flipv = node.flipv;	        			
         			} else {
                 		flipv= "1";	        			         					
         			}
            	}
         	cl += " " + fliph + " " + flipv;
		cl += " " + cameraProc;          		

         	if (RED.settings.verbose) { node.log(cl); }
            
            filefqn = filepath + filename;

            var child = exec(cl, {encoding: 'binary', maxBuffer:10000000}, function (error, stdout, stderr) {
                var retval = new Buffer(stdout,"binary");
                try {
                    if (isUtf8(retval)) { retval = retval.toString(); }
                } catch(e) {
                    node.log(RED._("exec.badstdout"));
                }
                                
                // check error 
                var msg2 = {payload:stderr};
                var msg3 = null;
                //console.log('[exec] stdout: ' + stdout);
                //console.log('[exec] stderr: ' + stderr);
                if (error !== null) {
                    msg3 = {payload:error};
                    //console.log('[exec] error: ' + error);
                    msg.payload = "";
                    msg.filename = "";
                    msg.fileformat = "";
                    msg.filepath = "";
                } else {
                    msg.filename = filename;
                    msg.filepath = filepath;
                    msg.fileformat = fileformat;

                    // get the raw image into payload and delete tempfile
                    if (filemode == "0") {
                    	// put the imagefile into payload
                    	msg.payload = fs.readFileSync(filefqn);

                    	// delete tempfile
               	   		fsextra.remove(filefqn, function(err) {
                   		  if (err) return console.error("CameraPi (err): "+ err);
                   		  console.log("CameraPi (log): " + filefqn + " remove success!")
                   		});	           				           			
                    } else {
                        msg.payload = filefqn;
                    }
                }
                
                node.status({});
                node.send(msg);
                delete node.activeProcesses[child.pid];
            });
            
            child.on('error',function(){});
            
            node.activeProcesses[child.pid] = child;
         	
        });
            
        // CameraPi-TakePhoto has a close 
        node.on('close', function(done) {
        	node.closing = true;
            done();
        });	
    }
	RED.nodes.registerType("camerapi-takephoto",CameraPiTakePhotoNode);

	// CameraPI Detect Node
    function CameraPiDetectNode(config) {
    	// Create this node
        RED.nodes.createNode(this,config);
        
        // set parameters and save locally 
        this.filemode = config.filemode;
		this.filename =  config.filename;
		this.filedefpath = config.filedefpath;
		this.filepath = config.filepath;
		this.fileformat = config.fileformat;
		this.detect = config.detect;
		this.framesize =  config.framesize;
		this.extract = config.extract;
		this.occurance = config.occurance;
	    this.repeat = config.repeat;
		this.name =  config.name;
		this.activeProcesses = {};

		var node = this;
		
        // if there is an new input
		node.on('input', function(msg) {
			
         	var fsextra = require("fs-extra");
         	var fs = require("fs");
         	var localdir = __dirname;
         	var defdir = '/home/pi/images';
            var cl = "python " + localdir + "/lib/python/face_detect.py";
         	var uuid = require('node-uuid').v4();
         	var filemode;
            var filename;
            var filepath;
            var fileformat;
            var filefqn;
            var detect;
            var framesize;
            var extract;

         	node.status({fill:"green",shape:"dot",text:"connected"});

         	// Check the given filemode
         	if((msg.filemode) && (msg.filemode !== "")) {
         		filemode = msg.filemode;
         	} else {
         		if (node.filemode) {
         			filemode = node.filemode;
         		} else {
         			filemode = "1";
         		}
         	}
         		
         	if (filemode == "0") {
         		filename = "pic_" + uuid + '.jpg';
         		fileformat = "jpeg";
         		filepath = defdir + "/";
         		filefqn = filepath + filename;

         		if (RED.settings.verbose) { node.log("camerapi detect:"+filefqn); }
         		console.log("CameraPi (log): Tempfile - " + filefqn);

                // put the raw image into a tempfile if running in buffer mode
            	fs.writeFileSync(filefqn, msg.payload);

         		cl += " " + filename + " " + filepath + " " + fileformat;
         	} else {
             	
     			if ((msg.filename) && (msg.filename.trim() !== "")) {
    	     			filename = msg.filename;
    	    	} else {
    	    		if (node.filename) {
    	         		filename = node.filename;
    	    		} else {
    	         		filename = "pic_" + uuid + '.jpg';
    	    		}
    	    	}
    			cl += " "+filename;
    	
    			if ((msg.filepath) && (msg.filepath.trim() !== "")) {
         			filepath = msg.filepath;
             	} else {
             		if (node.filepath) {
             			filepath = node.filepath;
             		} else {
             			if (detect == "1") {
                 			filepath = defdir + "/faces/";
             			} else {
                 			filepath = defdir + "/objects/";
             			}
             		}
             	}
     			cl += " "+filepath;
     	 		     		
             	if ((msg.fileformat) && (msg.fileformat.trim() !== "")) {
         			fileformat = msg.fileformat;
             	} else {
             		if (node.fileformat) {
             			fileformat = node.fileformat;
             		} else {
             			fileformat = "jpeg";
             		}
             	}
     			cl += " "+fileformat;
         	}

     		filefqn = filepath + filename;

         	if ((msg.detect) && (msg.detect !== "")) {
         		detect = msg.detect;
         	} else {
         		if (node.detect) {
             		detect = node.detect;
         		} else {
             		detect = "1";
         		}
         	}
     		cl += " " + detect;

         	if ((msg.framesize) && (msg.framesize !== "")) {
         		framesize = msg.framesize; 
         	} else {
         		if (node.framesize) {
             		framesize = node.framesize;	        			         			
         		} else {
             		framesize = "1";	      
             		}
         	}
         	if (framesize == "1") {
             	cl += " 15 20"; 
         	} else if (framesize == "2" ) {
             	cl += " 20 25";          		
         	} else  {
             	cl += " 25 30";          		
         	}

         	if ((msg.extract) && (msg.extract !== "")) {
         		extract = msg.extract; 
         	} else {
         		if (node.extract) {
             		extract = node.extract;	        			         			
         		} else {
             		extract = "0";	      
             		}
         	}
     		cl += " " + extract;

            if (RED.settings.verbose) { node.log(cl); }
            
            var child = exec(cl, {encoding: 'binary', maxBuffer:10000000}, function (error, stdout, stderr) {
                var retjson = {};
            	var retval = new Buffer(stdout,"binary");
                try {
                    if (isUtf8(retval)) { retval = retval.toString(); }
                } catch(e) {
                    node.log(RED._("exec.badstdout"));
                }

                // console.log('camerapi-detect:'+retval);

                msg.faces = [];

                // check error 
                var msg2 = {payload:stderr};
                var msg3 = null;
                //console.log('[exec] stdout: ' + stdout);
                //console.log('[exec] stderr: ' + stderr);
                if (error !== null) {
                    msg3 = {payload:error};
                    //console.log('[exec] error: ' + error);
                    msg.payload = 0;
                    // msg.filename = "";
                    // msg.filepath = "";
                    // msg.fileformat = "";
                } else {
                    if (detect == "1") {
                        if (RED.settings.verbose) { node.log('camerapi-detect:'+retval); }
                        
                        retjson = JSON.parse(retval);
                        console.log('camerapi-detect:' + retjson);
                        msg.facecount = retjson.facecount;
                        msg.payload = retjson.facecount;
                    	msg.faces = retjson.faces;
                    }                	

                    if (filemode == "0") {
                    	// delete tempfile
               	   		fsextra.remove(filefqn, function(err) {
                   		  if (err) return console.error("CameraPi (err): "+ err);
                   		  console.log("CameraPi (log): " +  filefqn + " remove success!")
                   		});	           				           			
                    } else {
                        msg.payload = filefqn;
                    }
                }
                
                node.status({});
                node.send(msg);
                delete node.activeProcesses[child.pid];
            });
            
            child.on('error',function(){});
            
            node.activeProcesses[child.pid] = child;
         	
        });
            
        // CameraPi-Detect has a close 
        node.on('close', function(done) {
        	node.closing = true;
            done();
        });	
    }
	RED.nodes.registerType("camerapi-detect",CameraPiDetectNode);
}
