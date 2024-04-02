const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null
app.use(express.json())

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log('DBerror:$e.messsage}')
    process.exit(1)
  }
}

initializeDBandServer()

const convertStateObjtoResObj = dbObject => {
  return {
    state_id: dbObject.state_id,
    state_name: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictObjtoResObj = dbObject => {
  return {
    district_id: dbObject.district_id,
    district_name: dbObject.district_name,
    state_id: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticationToken(request, response, next) {
  let jwtToken
  const authHeader = request.header['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
    console.log(jwtToken)
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, playload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticationToken, async (request, response) => {
  const getStateQuery = `SELECT * FROM state;`
  const stateArray = await db.all(getStateQuery)
  response.send(stateArray.map(eachstate => convertStateObjtoResObj(eachstate)))
})

app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `SELECT * FROM state WHERE state_id = '${stateId}`
  const state = await db.get(getStateQuery)
  response.send(convertStateObjtoResObj(state))
})

app.post('/districts/', authenticationToken, async (request, response) => {
  const {stateId, districtName, cases, curved, active, deaths} = request.body
  const postDistrictQuery = `INSERT INTO district (state_id,district_name,cases,curved,active,deaths)VALUES(${stateId},'${districtName}',${cases},${curved},${active},${deaths});`
  await db.run(postDistrictQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getSelectQuery = `SELECT * FROM district WHERE district_id = '${districtId};`
    const district = await db.get(getSelectQuery)
    response.send(convertDistrictObjtoResObj(district))
  },
)

app.delete(
  'districts/:districtId',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDelQuery = `DELETE * FROM district WHERE district_id='${districtId};`
    await db.run(getDelQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.param
    const updateQuery = `UPDATE district SET district_name = '${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id=${districtId};`
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats',
  authenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const getstatesstatsQuery = `SELECT SUM(cases),SUM(cured),SUM(active),SUM(deaths) FROM district WHERE state_id=${stateId};`
    const stats = await db.get(getstatesstatsQuery)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
