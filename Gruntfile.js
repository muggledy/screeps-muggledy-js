module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');

    // 获取环境变量中的 API Token
    // set SCREEPS_API_TOKEN=your_api_token
    const screepsToken = process.env.SCREEPS_API_TOKEN;

    if (!screepsToken) {
        console.error('未找到 SCREEPS_API_TOKEN 环境变量，请设置该变量。');
        return;
    }

    grunt.initConfig({
        screeps: {
            options: {
                email: '3101266674@qq.com',
                token: screepsToken,
                branch: 'default',
                //server: 'season'
            },
            dist: {
                src: ['src/*.js']
            }
        }
    });

    // 注册默认任务
    grunt.registerTask('default', ['screeps']);
}