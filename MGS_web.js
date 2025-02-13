var ref_img = document.getElementById("image_sample"); 
var load_img = document.getElementById("image");
var sim = document.getElementById("simulation");
var anim = document.getElementById("animation");
var ctx = document.getElementById("Ref_win").getContext("2d");
var ctx_f = document.getElementById("For_win").getContext("2d");
var t_slider = document.getElementById("t");
var im_data;
const Qx = 200;         //Size of the field
const Qy = 200;         //Size of the field
const dx = 1;
const dy = 1;
var v = new Array();    //Voronoi cells
const st_max = 200;     //Number of iterations in the simulation
const dt = 0.1;         //Step size in the simulation
var Data = new Array();

//Initialization of the Voronoi cells
for(let y=0; y<Qy; y++){
    v[y] = new Array();
    for(let x=0; x<Qx; x++){
        v[y][x]=0;
    }
}

//Function to enable or disable certain operations
function ope(state){
    ref_img.disabled = state;
    load_img.disabled = state;
    sim.disabled = state;
    anim.disabled = state;
    t_slider.disabled = state;
}

//Function to display an image selected from the Reference Image menu in the Reference Image window
function getCSV(file){
    var req = new XMLHttpRequest();
    req.open("get", file, true);
    req.send(null);
	
    req.onload = function(){
        var csv = req.responseText.split(',');
        csv = new Uint8ClampedArray(csv.map(Number));
        im_data = new ImageData(csv,Qy,Qx);
        ctx.putImageData(im_data,0,0);              //Displaying the selected image in the Reference Image window
    }
}

//Function to display an image imported via the Reference Image button in the Reference Image window
function previewImage(obj){
    if(obj.files[0] == null){
        return;
    }
    ctx.clearRect(0,0,Qx,Qy);
    ref_img.value = "none";
    var fileReader = new FileReader();
    fileReader.readAsDataURL(obj.files[0])
    fileReader.onload = function(){
        var img = new Image();
        im_data = new Image();
        img.src = fileReader.result;
        img.onload = function(){
            if(img.height == img.width){
                ctx.drawImage(img,0,0,Qx,Qy);                               
            }
            else{
                ctx.drawImage(img,0,0);
            }
            im_data = ctx.getImageData(0,0,Qx,Qy);
            var num = im_data.data.length;
            var pix = num/4;
            //When a color image is imported, it is converted to its grayscale version.
            for(let i=0; i<pix; i++){
                var r = im_data.data[i*4];
                var g = im_data.data[i*4+1];
                var b = im_data.data[i*4+2];
                var gray = Math.round((r*30+g*59+b*11)/100);
                im_data.data[i*4] = gray;
                im_data.data[i*4+1] = gray;
                im_data.data[i*4+2] = gray;
            }
            ctx.putImageData(im_data,0,0);      //Displaying the imported image in the Reference Image window
        }
    }
}

//Function to simulate the mass game for the given reference image
function simulation(){
    
    if(im_data == null){
        console.warn('Please load an image.');
        return;
    }

    ope(true);
    ctx_f.clearRect(0,0,Qx,Qy);
    var t = 0;
    var n = parseFloat(document.getElementById("n").value);         //Number of agents
    var k = parseFloat(document.getElementById("speed").value);     //Moving speed of agents
    var kappa = parseFloat(document.getElementById("kappa").value); //Contrast of the image of the resulting formation

    var id;
    var varphi;
    var pos = new Array();
    var Phi = new Array();

    //Calculating the value of a weighting function at each location based on the reference image
    for(let y=0; y<Qy; y++){
        Phi[y] = new Array();
        for(let x=0; x<Qx; x++){
            id = y*4*Qx+x*4;
            varphi = (255-im_data.data[id])/255;
            phi = Math.exp(kappa*(varphi-1));
            Phi[y][x] = phi;
        }
    }
    
    //Array to store the time evolution of agent positions
    for(var i=0; i<=st_max; i++){
        Data[i] = new Array();
        for(let j=0; j<n; j++){
            Data[i][j] = 0;
            Data[i][n+j] = 0;
        }
    }

    //Determining the initial positions of agents randomly
    for(i=0; i<n; i++){
        pos[i] = [(Qx-1)*Math.random(),(Qy-1)*Math.random()]
        Data[0][i] = pos[i][0];
        Data[0][i+n] = pos[i][1];
    }

    //Simulation of the mass game
    function loop_s(){
        if(t>=st_max){
            ctx_f.clearRect(0,0,Qx,Qy);
            ctx_f.fillStyle = 'rgb(0,0,0)';
            for(i=0; i<n; i++){
                ctx_f.fillRect(Data[0][i],Data[0][i+n],2,2);    //Displaying the initial positions of agents in the Formation window
            }
            ope(false);
            t_slider.value = 0;
            return;
        }
        pos = step(t,n,k,Phi,pos);              //Algorithm executed at each time step
        t++;
        window.requestAnimationFrame(loop_s);
    }
    window.requestAnimationFrame(loop_s);

}

//Function to calculate the positions of agents at the next time step
function step(t,n,k,Phi,pos){
    var u = new Array();
    var R;
    var voro_out = new Array();
    var x_l;
    var x_r;
    var y_t;
    var y_u;
    var phidq;
    var qphidq;
    var cent;    

    for(let i=0; i<n; i++){
        u[i] = [0,0];

        //Determining the Voronoi cells for the current positions of agents
        R = 2;
        voro_out = voro(R,i,n,pos);
        while(((R<2*voro_out[0])||(voro_out[0]==0))&&(R<Qx)){
            R = 2*R;
            voro_out = voro(R,i,n,pos);                    
        }

        //Calculating the control inputs applied to agents
        if(voro_out[0]!=0){
            x_l = voro_out[1];
            x_r = voro_out[2];
            y_t = voro_out[3];
            y_u = voro_out[4];
            phidq = 0;
            qphidq = [0,0];    
            for(let y=y_t; y<=y_u; y++){                            
                for(let x=x_l; x<=x_r; x++){
                    if(v[y][x]==1){
                        phidq = phidq+Phi[y][x];
                        qphidq = [qphidq[0]+(x+dx/2)*Phi[y][x],qphidq[1]+(y+dy/2)*Phi[y][x]];
                    }
                }
            }
            cent = [qphidq[0]/phidq,qphidq[1]/phidq];
            u[i] = [k*(cent[0]-pos[i][0]),k*(cent[1]-pos[i][1])];
        }

        //Updating the positions of agents
        pos[i][0] = pos[i][0]+u[i][0]*dt;
        pos[i][1] = pos[i][1]+u[i][1]*dt;
        Data[t+1][i] = pos[i][0];
        Data[t+1][i+n] = pos[i][1];
    }
    console.log('time: '+ t);
    if((t==0)||(t+1)%20==0){
        document.getElementById("Progress").value = t+1;
        document.getElementById("Progress").innerText = (t+1)+"%";
    }
    return pos;
}

//Function to determine the Voronoi cell for agent i
function voro(R,i,n,data){
    var D = new Array();
    var xi = data[i][0];
    var yi = data[i][1];
    var q_max = 0;
    var dis = 0;
    
    for(var l=0; l<n; l++){
        dis = Math.sqrt(((data[l][0]-xi)**2)+((data[l][1]-yi)**2))
        if((dis<R)&&(dis!=0)){
            D[l] = data[l];
        }
    }
    D = D.filter(s=>s);

    if(D.length == 0){
        q_max = 0;
        var x_l = 0;
        var x_r = 0;
        var y_t = 0;
        var y_u = 0;
        return [q_max,x_l,x_r,y_t,y_u];
    }

    var a = new Array();
    var b = new Array();
    var c = new Array();
    var d = new Array();
    var e = 0;
    var f = 0;

    for(l=0; l<D.length; l++){
        a[l] = -((D[l][0]-xi)/(D[l][1]-yi));
        b[l] = (D[l][1]**2-yi**2+D[l][0]**2-xi**2)/(2*(D[l][1]-yi));
        c[l] = (yi-a[l]*xi-b[l]>0)?1:0;
    }

    var x_l = Math.floor(xi-R);
    if(x_l<0){
        x_l = 0;
    }

    var x_r = Math.ceil(xi+R);
    if(x_r>Qx-1){
        x_r = Qx-1;
    }

    var y_u = Math.ceil(yi+R);
    if(y_u>Qy-1){
        y_u = Qy-1;
    }

    var y_t = Math.floor(yi-R);
    if(y_t<0){
        y_t = 0;
    }

    var y_m = Math.round(yi);

    //Initialization of v
    for(var y=0; y<Qy; y++){
        for(var x=0; x<Qx; x++){
            v[y][x]=0;
        }
    }
    
    //Determining the Voronoi cell for agent i
    for(y=y_m; y>=y_t; y--){
        f = 0;
        for(x=x_l; x<=x_r; x++){
            for(l=0; l<D.length; l++){
                d[l]=((y+dy/2)-a[l]*(x+dx/2)-b[l]>0)?1:0
                if(d[l]!=c[l]){
                    break;
                }
            }
            if(l==D.length){
                e = Math.sqrt((((x+dx/2)-xi)**2)+(((y+dy/2)-yi)**2));
                if(e<R){
                    v[y][x] = 1;
                    f = 1;
                    if(q_max<e){
                        q_max = e;
                    }
                }   
            }
        }
        if(f==0){
            break;
        }
    }
    
    for(y=y_m; y<=y_u; y++){
        f = 0;
        for(x=x_l; x<=x_r; x++){
            for(l=0; l<D.length; l++){
                d[l] = ((y+dy/2)-a[l]*(x+dx/2)-b[l]>0)?1:0
                if(d[l]!=c[l]){
                    break;
                }
            }
            if(l==D.length){
                e = Math.sqrt((((x+dx/2)-xi)**2)+(((y+dy/2)-yi)**2));
                if(e<R){
                    v[y][x] = 1;
                    f = 1;
                    if(q_max<e){
                        q_max = e;
                    }
                }   
            }
        }
        if(f==0){
            break;
        }
    }                
    
    return [q_max,x_l,x_r,y_t,y_u];
}

//Function to play the animation of agents' behavior
function animation(){
    if(Data[0] == null){
        console.warn('You have no simulation result.');
        return;
    }
    ope(true);
    var t = 0;
    function loop_a(){
        if(t>st_max){
            ope(false);
            return
        }
        ani_plot(t);
        t++;
        window.requestAnimationFrame(loop_a);
    }
    window.requestAnimationFrame(loop_a);
}

//Function to display the positions of agents at a given time step in the Formation window
function ani_plot(t){
    var n = (Data[0].length)/2;
    ctx_f.clearRect(0,0,Qx,Qy);
    ctx_f.fillStyle = 'rgb(255,255,255)';
    ctx_f.fillRect(0,0,Qx,Qy);
    ctx_f.fillStyle = 'rgb(0,0,0)';
    for(let i=0; i<n; i++){
        ctx_f.fillRect(Data[t][i],Data[t][i+n],2,2);
    }
    //Updating the Simulation/Animation Progress bar
    if(t%10==0){
        document.getElementById("Progress").value = t;
        document.getElementById("Progress").innerText = t+"%"; 
    }
}

//Assigning functions to the Simulation and Animation buttons and the Reference Image menu 
sim.addEventListener('click',simulation);
anim.addEventListener('click',animation);
ref_img.addEventListener('change',function(){
    ctx.clearRect(0,0,Qx,Qy);
    switch(ref_img.value){
        case "Mandrill":
            getCSV("./images/Mandrill.csv");
            break;
        case "Barbara":
            getCSV("./images/Barbara.csv");
            break;
        case "Peppers":
            getCSV("./images/Peppers.csv");
            break;
        case "Parrots":
            getCSV("./images/Parrots.csv");
            break;
        default:
            return;
    }
});

//Defining the behavior of the Time slider
t_slider.addEventListener('change',function(){
    if(Data[0] != null){
        ctx_f.clearRect(0,0,Qx,Qy);
        ctx_f.fillStyle = 'rgb(0,0,0)';
        var n = (Data[0].length)/2;
        for(let i=0; i<n; i++){
            ctx_f.fillRect(Data[t_slider.value][i],Data[t_slider.value][i+n],2,2);
        }
    }  
});


