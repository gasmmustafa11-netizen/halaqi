import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("🤖 اسألني أي سؤال");

function chat() {
  rl.question("أنت: ", function(question) {

    console.log("AI: أنت سألت: " + question);

    chat();
  });
}

chat();
