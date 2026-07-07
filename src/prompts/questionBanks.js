/**
 * Real, commonly-asked interview questions for the popular quick-pick skills.
 * These ground the AI interviewer in questions people actually get asked, rather
 * than letting it invent unusual or overly academic ones. Skills typed freely
 * (not in this list) fall back to the AI generating questions on its own -
 * getQuestionBankFor returns null in that case, and buildInterviewPrompt handles
 * that gracefully.
 */
export const QUESTION_BANKS = {
  'Java Collections': [
    'What is the difference between ArrayList and LinkedList?',
    'How does HashMap work internally in Java?',
    'What is the difference between HashMap and Hashtable?',
    'What is the difference between Comparable and Comparator?',
    'What is a ConcurrentModificationException and when does it occur?',
    'What is the difference between fail-fast and fail-safe iterators?',
  ],
  'Java OOPs': [
    'What are the four pillars of OOP?',
    'What is the difference between method overloading and overriding?',
    'What is the difference between an abstract class and an interface?',
    'What is polymorphism and how is it achieved in Java?',
    'Can you explain constructor chaining?',
    'What is the difference between composition and inheritance?',
  ],
  Selenium: [
    'What is the difference between findElement and findElements?',
    'How do you handle dynamic web elements in Selenium?',
    'What is the difference between implicit wait and explicit wait?',
    'How do you handle multiple windows or tabs in Selenium?',
    'What is the Page Object Model and why is it used?',
    'How do you handle a dropdown or a file upload in Selenium?',
  ],
  TestNG: [
    'What is the difference between @BeforeMethod and @BeforeClass?',
    'How do you achieve parallel execution in TestNG?',
    'What is a TestNG listener and when would you use one?',
    'How do you group test cases in TestNG?',
    'What is the difference between @DataProvider and a hardcoded parameter?',
    'How do you set test priority and dependency in TestNG?',
  ],
  SQL: [
    'What is the difference between INNER JOIN and LEFT JOIN?',
    'What is the difference between WHERE and HAVING?',
    'How would you find duplicate records in a table?',
    'What is normalization and why is it important?',
    'What is the difference between DELETE, TRUNCATE, and DROP?',
    'How do you write a query to get the second highest salary?',
  ],
  JMeter: [
    'What is a Thread Group in JMeter?',
    'What is the difference between a load test and a stress test?',
    'How do you parameterize data in JMeter?',
    'What are Listeners in JMeter used for?',
    'How do you correlate dynamic values like session tokens?',
    'What is the difference between ramp-up period and loop count?',
  ],
  'API Testing': [
    'What is the difference between PUT and PATCH?',
    'How do you validate a JSON response schema?',
    'What is the difference between authentication and authorization?',
    'How do you handle testing endpoints that require OAuth tokens?',
    'What status codes indicate client errors versus server errors?',
    'How would you test an API for idempotency?',
  ],
  'Cucumber/BDD': [
    'What is Gherkin syntax and why is it used?',
    'What is the difference between Scenario and Scenario Outline?',
    'What are hooks in Cucumber and when would you use them?',
    'How do you share data between step definitions?',
    'What is the purpose of tags in Cucumber?',
    'How do you generate reports in Cucumber?',
  ],
  Docker: [
    'What is the difference between a Docker image and a container?',
    'What is the purpose of a Dockerfile?',
    'How do you persist data in Docker using volumes?',
    'What is the difference between CMD and ENTRYPOINT?',
    'How do containers communicate with each other?',
    'What is Docker Compose used for?',
  ],
  Jenkins: [
    'What is a Jenkins pipeline, and declarative versus scripted?',
    'How do you trigger a Jenkins job automatically on a commit?',
    'Can you name a few commonly used Jenkins plugins?',
    'How do you handle credentials securely in a pipeline?',
    'What is a Jenkinsfile?',
    'How do you set up notifications for build failures?',
  ],
  Git: [
    'What is the difference between git merge and git rebase?',
    'What is the difference between git fetch and git pull?',
    'How do you resolve a merge conflict?',
    'What is git cherry-pick and when would you use it?',
    'What is the difference between git reset and git revert?',
    'How do you undo the last commit without losing changes?',
  ],
  'Spring Boot': [
    'What is dependency injection and how does Spring Boot implement it?',
    'What is the difference between @Component, @Service, and @Repository?',
    'What is the purpose of application.properties or application.yml?',
    'How does Spring Boot auto-configuration work?',
    'What is the difference between @RequestParam and @PathVariable?',
    'How do you handle exceptions globally in a Spring Boot app?',
  ],
};

export function getQuestionBankFor(skill) {
  if (!skill) return null;
  return QUESTION_BANKS[skill.trim()] || null;
}

/**
 * Returns a randomly shuffled subset of the bank each time it's called - this is
 * what makes different interview sessions for the same skill feel different from
 * each other, instead of the AI seeing the exact same reference list (and often
 * defaulting to the same order) every single time.
 */
export function getShuffledSampleFor(skill, count = 5) {
  const bank = getQuestionBankFor(skill);
  if (!bank) return null;
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
