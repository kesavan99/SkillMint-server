/**
 * Skill matching utilities using exact matching and synonym expansion
 */

const TextProcessor = require('./textProcessor');

class SkillMatcher {
  constructor() {
    // Common skill synonyms
    this.skillSynonyms = {
      'javascript': ['js', 'ecmascript', 'node.js', 'nodejs'],
      'typescript': ['ts'],
      'python': ['py'],
      'kubernetes': ['k8s'],
      'docker': ['containerization', 'containers'],
      'aws': ['amazon web services', 'amazon cloud'],
      'gcp': ['google cloud platform', 'google cloud'],
      'azure': ['microsoft azure'],
      'postgresql': ['postgres', 'psql'],
      'mongodb': ['mongo'],
      'react': ['reactjs', 'react.js'],
      'angular': ['angularjs', 'angular.js'],
      'vue': ['vuejs', 'vue.js'],
      'machine learning': ['ml', 'deep learning', 'neural networks'],
      'artificial intelligence': ['ai'],
      'continuous integration': ['ci', 'ci/cd'],
      'continuous deployment': ['cd', 'ci/cd'],
      'node': ['nodejs', 'node.js'],
      'express': ['expressjs', 'express.js'],
      'next': ['nextjs', 'next.js'],
      'mysql': ['sql'],
      'sql server': ['mssql'],
      'restful': ['rest', 'rest api'],
      'graphql': ['gql'],
    };

    // Comprehensive tech keywords list
    this.techKeywords = new Set([
      // Programming Languages
      'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'c', 'ruby',
      'php', 'go', 'golang', 'rust', 'swift', 'kotlin', 'scala', 'perl', 'r',
      'matlab', 'julia', 'dart', 'elixir', 'haskell', 'clojure', 'objective-c',
      'groovy', 'lua', 'shell', 'bash', 'powershell', 'vba', 'cobol', 'fortran',
      
      // Frontend Frameworks & Libraries
      'react', 'reactjs', 'react.js', 'angular', 'angularjs', 'vue', 'vuejs',
      'vue.js', 'svelte', 'next.js', 'nextjs', 'nuxt', 'gatsby', 'ember',
      'backbone', 'jquery', 'bootstrap', 'tailwind', 'material-ui', 'mui',
      'ant design', 'chakra ui', 'sass', 'scss', 'less', 'styled-components',
      'emotion', 'redux', 'mobx', 'recoil', 'zustand', 'webpack', 'vite',
      'rollup', 'parcel', 'babel', 'eslint', 'prettier', 'jest', 'cypress',
      'playwright', 'selenium', 'webdriver', 'storybook',
      
      // Backend Frameworks
      'node', 'nodejs', 'node.js', 'express', 'expressjs', 'nestjs', 'fastify',
      'koa', 'django', 'flask', 'fastapi', 'pyramid', 'tornado', 'spring',
      'spring boot', 'springboot', 'hibernate', 'struts', 'jsf', 'play',
      'laravel', 'symfony', 'codeigniter', 'yii', 'rails', 'ruby on rails',
      'sinatra', 'asp.net', '.net', 'dotnet', '.net core', 'entity framework',
      'gin', 'echo', 'beego', 'fiber', 'actix', 'rocket', 'warp',
      
      // Mobile Development
      'react native', 'flutter', 'ionic', 'xamarin', 'cordova', 'phonegap',
      'android', 'ios', 'swift ui', 'jetpack compose', 'kotlin multiplatform',
      
      // Databases - SQL
      'sql', 'mysql', 'postgresql', 'postgres', 'oracle', 'sql server', 'mssql',
      'sqlite', 'mariadb', 'db2', 'teradata', 'snowflake', 'redshift',
      'bigquery', 'aurora', 'cockroachdb',
      
      // Databases - NoSQL
      'nosql', 'mongodb', 'cassandra', 'couchdb', 'dynamodb', 'neo4j',
      'redis', 'memcached', 'elasticsearch', 'solr', 'firebase', 'firestore',
      'realm', 'couchbase', 'hbase', 'riak',
      
      // Cloud Platforms
      'aws', 'amazon web services', 'ec2', 's3', 'lambda', 'cloudformation',
      'cloudfront', 'route53', 'rds', 'sqs', 'sns', 'kinesis',
      'azure', 'microsoft azure', 'azure devops', 'gcp', 'google cloud',
      'google cloud platform', 'heroku', 'digitalocean', 'linode',
      'vultr', 'cloudflare', 'vercel', 'netlify', 'render',
      
      // DevOps & CI/CD
      'docker', 'kubernetes', 'k8s', 'openshift', 'rancher', 'helm', 'istio',
      'jenkins', 'gitlab ci', 'github actions', 'circleci', 'travis ci',
      'teamcity', 'bamboo', 'azure pipelines', 'argo cd', 'flux', 'spinnaker',
      'terraform', 'ansible', 'puppet', 'chef', 'saltstack', 'vagrant',
      'packer', 'consul', 'vault', 'prometheus', 'grafana', 'datadog',
      'new relic', 'splunk', 'elk stack', 'logstash', 'kibana', 'fluentd',
      
      // Version Control
      'git', 'github', 'gitlab', 'bitbucket', 'svn', 'mercurial', 'perforce',
      'git flow', 'trunk based development',
      
      // Testing
      'junit', 'testng', 'mockito', 'pytest', 'unittest', 'nose', 'jest',
      'mocha', 'jasmine', 'karma', 'protractor', 'cucumber', 'behave', 'rspec',
      'xunit', 'nunit', 'mstest', 'postman', 'insomnia', 'jmeter', 'gatling',
      'locust', 'k6',
      
      // Message Queues & Streaming
      'kafka', 'rabbitmq', 'activemq', 'zeromq', 'nats', 'pulsar', 'mqtt',
      'redis pub/sub', 'amazon sqs', 'google pub/sub', 'azure service bus',
      
      // API & Protocols
      'rest', 'restful', 'graphql', 'grpc', 'soap', 'websocket',
      'http', 'https', 'tcp', 'udp', 'oauth', 'jwt', 'saml', 'openid',
      
      // Architecture & Patterns
      'microservices', 'monolith', 'serverless', 'event driven', 'cqrs',
      'event sourcing', 'domain driven design', 'ddd', 'clean architecture',
      'hexagonal architecture', 'mvc', 'mvvm', 'mvp', 'soa', 'rest api',
      
      // Machine Learning & AI
      'machine learning', 'ml', 'deep learning', 'neural networks', 'cnn',
      'rnn', 'lstm', 'gru', 'transformer', 'bert', 'gpt', 'llm', 'nlp',
      'computer vision', 'opencv', 'tensorflow', 'pytorch', 'keras',
      'scikit-learn', 'sklearn', 'xgboost', 'lightgbm', 'catboost',
      'pandas', 'numpy', 'scipy', 'matplotlib', 'seaborn', 'plotly',
      'hugging face', 'langchain', 'llama', 'stable diffusion', 'yolo',
      
      // Data Engineering & Big Data
      'hadoop', 'spark', 'pyspark', 'hive', 'pig', 'sqoop', 'flume',
      'airflow', 'luigi', 'prefect', 'dagster', 'dbt', 'databricks',
      'presto', 'trino', 'flink', 'storm', 'samza', 'beam', 'dataflow',
      
      // Operating Systems & Tools
      'linux', 'unix', 'ubuntu', 'centos', 'rhel', 'debian', 'fedora',
      'windows', 'macos', 'vim', 'emacs', 'vscode',
      'intellij', 'eclipse', 'netbeans', 'pycharm', 'webstorm',
      
      // Methodologies & Practices
      'agile', 'scrum', 'kanban', 'lean', 'devops', 'ci/cd', 'tdd',
      'test driven development', 'bdd', 'behavior driven development',
      'pair programming', 'code review', 'solid', 'design patterns',
      
      // Other Technologies
      'webscraping', 'web scraping', 'beautifulsoup', 'scrapy',
      'nginx', 'apache', 'tomcat', 'iis', 'load balancing', 'caching',
      'cdn', 'oauth2', 'authentication', 'authorization', 'encryption',
      'ssl', 'tls', 'vpn', 'api gateway', 'service mesh', 'etl',
      'data warehouse', 'data lake', 'olap', 'oltp', 'indexing',
      'sharding', 'replication', 'partitioning', 'normalization',
    ]);
  }

  /**
   * Normalize a list of skills
   * @param {string[]} skills - Array of skills
   * @returns {Set<string>} Normalized skills set
   */
  normalizeSkills(skills) {
    const normalized = new Set();
    
    for (const skill of skills) {
      if (!skill) continue;
      
      const normSkill = TextProcessor.normalizeSkill(skill);
      normalized.add(normSkill);
      
      // Add synonyms
      if (this.skillSynonyms[normSkill]) {
        for (const synonym of this.skillSynonyms[normSkill]) {
          normalized.add(synonym);
        }
      }
    }
    
    return normalized;
  }

  /**
   * Match skills using exact matching with synonym expansion
   * @param {string[]} resumeSkills - Resume skills
   * @param {string[]} jobSkills - Job required skills
   * @returns {{ matched: Set<string>, missing: Set<string>, matchPct: number }}
   */
  matchSkillsWithSynonyms(resumeSkills, jobSkills) {
    if (!resumeSkills || !jobSkills || resumeSkills.length === 0 || jobSkills.length === 0) {
      return { matched: new Set(), missing: new Set(jobSkills || []), matchPct: 0 };
    }
    
    const normResume = this.normalizeSkills(resumeSkills);
    const normJob = this.normalizeSkills(jobSkills);
    
    const matched = new Set();
    const missing = new Set();
    
    for (const skill of normJob) {
      if (normResume.has(skill)) {
        matched.add(skill);
      } else {
        missing.add(skill);
      }
    }
    
    const matchPct = normJob.size > 0 ? matched.size / normJob.size : 0;
    
    return { matched, missing, matchPct };
  }

  /**
   * Match resume skills against job requirements
   * @param {string[]} resumeSkills - Resume skills
   * @param {string[]} requiredSkills - Required job skills
   * @param {string[]} preferredSkills - Preferred job skills
   * @returns {Object} Skill analysis result
   */
  matchSkills(resumeSkills, requiredSkills, preferredSkills = []) {
    // Match required skills
    const { matched: matchedRequired, missing: missingRequired, matchPct: requiredMatchPct } =
      this.matchSkillsWithSynonyms(resumeSkills, requiredSkills);
    
    // Match preferred skills
    const { matched: matchedPreferred, missing: missingPreferred, matchPct: preferredMatchPct } =
      this.matchSkillsWithSynonyms(resumeSkills, preferredSkills);
    
    // Calculate percentages
    const requiredMatchPercentage = requiredMatchPct * 100;
    const preferredMatchPercentage = preferredMatchPct * 100;
    
    // Calculate overall score (70% required, 30% preferred)
    const overallScore = (requiredMatchPercentage * 0.7) + (preferredMatchPercentage * 0.3);
    
    return {
      matchedRequired: Array.from(matchedRequired),
      matchedPreferred: Array.from(matchedPreferred),
      missingRequired: Array.from(missingRequired),
      missingPreferred: Array.from(missingPreferred),
      requiredMatchPercentage: Math.round(requiredMatchPercentage * 100) / 100,
      preferredMatchPercentage: Math.round(preferredMatchPercentage * 100) / 100,
      overallSkillScore: Math.round(overallScore * 100) / 100,
      totalMatched: matchedRequired.size + matchedPreferred.size,
      totalMissing: missingRequired.size + missingPreferred.size
    };
  }

  /**
   * Extract potential skills from free text
   * @param {string} text - Input text
   * @returns {string[]} Extracted skills
   */
  extractSkillsFromText(text) {
    if (!text) return [];
    
    const technicalTerms = TextProcessor.extractTechnicalTerms(text);
    const keywords = TextProcessor.extractKeywords(text);
    
    const allTerms = new Set([...technicalTerms, ...keywords]);
    const skills = [];
    
    for (const term of allTerms) {
      if (this.techKeywords.has(term.toLowerCase())) {
        skills.push(term);
      }
    }
    
    return skills;
  }
}

module.exports = SkillMatcher;
