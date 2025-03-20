1. Use [Grunt](https://docs.screeps.com/commit.html) to upload local src/*.js to Screeps default branch: `grunt`(see task config in Gruntfile.js). You need to install the following two dependencies in advance:
    ```cmd
    > npm install -g grunt-cli
    > npm install grunt grunt-screeps
    ```
2. Game strategy:
    ```txt
    1. firstly generate creeps one by one to harvest energy until the creeps quantity reaches 3(when the original spawn energy is full, 
       the 3 creeps will goto build spawn extensions)
    2. after step 1 is completed, continue to generate 3 creeps to collect energy to upgrade the room controller
    3. ...
    ```