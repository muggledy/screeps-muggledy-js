1. Use [Grunt](https://docs.screeps.com/commit.html) to upload local src/*.js to Screeps default branch: `grunt`(see task config in Gruntfile.js). You need to install the following two dependencies in advance:
    ```cmd
    > npm install -g grunt-cli
    > npm install grunt grunt-screeps
    ```
2. Game strategy:
    ```txt
    1. firstly generate type-1 creeps one by one to harvest energy until the creeps quantity reaches 3
    2. after step 1 is completed, continue to generate 3 type-2 creeps to collect energy to upgrade the room controller
    3. when the original spawn energy is full, the 3 type-1 creeps will goto build spawn extension
    4. when the spawn extension is also full of energy, the 3 type-1 creeps will also goto upgrade the room controller
    5. after step 2 is completed, continue to gernerate 3 type-4 creeps to build the city wall
    6. when the room controller level >=3, create 3 creeps to build towers to attack enemies
    7. ...
    ```