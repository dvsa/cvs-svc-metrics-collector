# cvs-metrics-collector

This microservice is used to send app logs to logging systems and reporting tools.

# Dependencies

The project runs on node >10.x with typescript and serverless framework. For further details about project dependencies, please refer to the `package.json` file.
[nvm](https://github.com/nvm-sh/nvm/blob/master/README.md) is used to managed node versions and configuration explicitly done per project using an `.npmrc` file.

### Prerequisites

Please install and run the following securiy programs as part of your development process:

- [git-secrets](https://github.com/awslabs/git-secrets)
  After installing, do a one-time set up with `git secrets --register-aws`. Run with `git secrets --scan`.
- [repo-security-scanner](https://github.com/UKHomeOffice/repo-security-scanner)
  These will be run as part of your projects hooks so you don't accidentally introduce any new security vulnerabilities.

## Getting started

Set up your nodejs environment running `nvm use` and once the dependencies are installed using `npm i`, you can run the scripts from `package.json` to build your project.

The following scripts are available:

- install dependencies: `npm install` or `npm i`
- build project: `npm run build`
- unit tests: `npm test` or `npm t`

## Architecture

### End to end design

[All in one view](https://wiki.dvsacloud.uk/pages/viewpage.action?pageId=79254695)

Low level designs are also available for this service:

- [Custom app logging](https://wiki.dvsacloud.uk/display/HVT/Custom+App+logging+for+CVS)
- [Application logging service design](https://wiki.dvsacloud.uk/display/HVT/Application+Logging+Service)

## Testing

Jest is used for unit testing.
Please refer to the [Jest documentation](https://jestjs.io/docs/en/getting-started) for further details.

### Unit test

In order to test, you need to run the following:

```sh
npm run test # unit tests
```

### End to end

- [Automation test repository](https://github.com/dvsa/cvs-auto-svc)
- [Java](https://docs.oracle.com/en/java/javase/11/)
- [Serenity Cucumber with Junit](https://serenity-bdd.github.io/theserenitybook/latest/junit-basic.html)

## Infrastructure

We follow a [gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) approach for development.
For the CI/CD and automation please refer to the following pages for further details:

- [Development process](https://wiki.dvsacloud.uk/display/HVT/CVS+Pipeline+Infrastructure)
- [Pipeline](https://wiki.dvsacloud.uk/pages/viewpage.action?pageId=36870584)

## Contributing

### Hooks and code standards

The projects has multiple hooks configured using [husky](https://github.com/typicode/husky#readme) which will execute the following scripts: `security-checks`, `audit`, `tslint`.
The codebase uses [typescript clean code standards](https://github.com/labs42io/clean-code-typescript) as well as sonarqube for static analysis.
SonarQube is available locally, please follow the instructions below if you wish to run the service locally (brew is the preferred approach).

### Static code analysis

_Brew_ (recommended):

- Install sonarqube using brew
- Change `sonar.host.url` to point to localhost, by default, sonar runs on `http://localhost:9000`
- run the sonar server `sonar start`, then perform your analysis `npm run sonar-scanner`
  _Manual_:
- [Download sonarqube](https://www.sonarqube.org/downloads/)
- Add sonar-scanner in environment variables in your profile file add the line: `export PATH=<PATH_TO_SONAR_SCANNER>/sonar-scanner-3.3.0.1492-macosx/bin:$PATH`
- Start the SonarQube server: `cd <PATH_TO_SONARQUBE_SERVER>/bin/macosx-universal-64 ./sonar.sh start`
- In the microservice folder run the command: `npm run sonar-scanner`

## Licence

Unless stated otherwise, the codebase is released under [the MIT License][mit].
This covers both the codebase and any sample code in the documentation.

The documentation is [© Crown copyright][copyright] and available under the terms
of the [Open Government 3.0][ogl] licence.

[mit]: LICENCE
[copyright]: http://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/crown-copyright/
[ogl]: http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
